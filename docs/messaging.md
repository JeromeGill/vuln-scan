# Messaging (job queue)

Background work runs outside the api, in workers that consume jobs from
**RabbitMQ**. Today there is one worker, `apps/worker` (NestJS), and one kind
of job: sending email. The api publishes verification emails. The setup is
meant to grow to other job types (e.g. scans) and to workers in other languages (e.g. Python), so
everything on the wire is plain JSON described by JSON Schema, and the
topology is a convention any AMQP client can follow. Why RabbitMQ and not
Nest's transports: see [Decisions](decisions/rabbitmq-job-queue-for-background-work.md).

```
producers (the api: verification emails)
  │  publish JSON envelope, routing key = message type
  ▼
vulnscan.jobs (topic exchange)
  │  email.#                         (future: scan.# → scan queue, …)
  ▼
email (quorum queue) ──consume──▶ apps/worker  ──SMTP──▶ Mailpit / provider
  ▲     │ fails?                        │
  │     │ republish with retry-count+1  │ invalid, refused, or retries used up
  │     ▼                               ▼
  └── email.retry.N (TTL, no consumer)  email.parked (kept for a human)
```

## Pieces

| Where                              | What                                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `packages/events` (`@repo/events`) | the envelope, one zod schema per message type, the topology constants; its build emits JSON Schema to `dist/schemas/`            |
| `apps/worker/src/messaging/`       | `AmqpConnection` (one connection, auto-recovery), `JobPublisher`, `JobConsumer` (validation, dispatch, retry, parking), topology |
| `apps/api/src/messaging/`          | the api's `JobPublisher`: publish only, connects on the first publish, declares only the exchange                                |
| `apps/worker/src/email/`           | the email queue's handlers (`VerifyEmailHandler`), templates, delivery deduplication                                             |
| `apps/worker/src/mail/`            | `MailerService` (abstract) and its SMTP implementation (nodemailer)                                                              |
| `docker-compose.yml`               | `rabbitmq` (4.3 with the management UI) and `mailpit`                                                                            |

Locally: RabbitMQ on `amqp://localhost:5672`, management UI at
http://localhost:15672 (`vulnscan` / `vulnscan`), Mailpit's inbox at
http://localhost:8025 (SMTP on 1025). On Railway the worker sends through
Resend (see [Deployment](deployment.md#email)). `SMTP_URL` and `MAIL_FROM`
have no defaults, so a worker without them doesn't start; once started,
`SmtpMailerService` logs whether the SMTP server accepts its connection and
credentials, without stopping the worker if it doesn't.

## Messages

Every message body is a JSON envelope
(`packages/events/src/envelope.ts`):

| Field        | Type                    | Notes                                                                   |
| ------------ | ----------------------- | ----------------------------------------------------------------------- |
| `id`         | UUID string             | unique per message; consumers deduplicate on it                         |
| `type`       | string                  | `<area>.<name>`, lower case, e.g. `email.verify-email`                  |
| `version`    | integer                 | bumped only for breaking changes to `data`; unknown versions are parked |
| `occurredAt` | ISO 8601 string, offset | when the producer created it                                            |
| `data`       | object                  | the type's payload                                                      |

Bodies use JSON types only: dates are ISO strings (`YYYY-MM-DD` for calendar
dates), no `Date` objects, no TypeScript-only constructs, so any language can
read them. AMQP properties mirror the envelope: `messageId` = `id`, `type` =
`type`, `contentType: application/json`, persistent delivery.

### Message types

| Type (version)           | Queue   | `data`                                                                                                        |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------- |
| `email.verify-email` (1) | `email` | `userId`, `email`, `name`, `url` (the verification link), `expiresAt` (ISO 8601: when the link stops working) |

The worker skips (acks without sending) a verification job whose
`expiresAt` has passed, since a retry after that would only send a dead
link; the user asks for a new one.

### JSON Schema for other languages

`pnpm --filter @repo/events build` writes `packages/events/dist/schemas/`:

- `envelope.json`: the generic envelope,
- `<type>.v<version>.json`: each full message (envelope + `data`), e.g.
  `email.verify-email.v1.json`,
- `topology.json`: exchange, queues, their exact arguments, header names, and
  parking reasons.

They're generated from the zod schemas (`z.toJSONSchema`, draft 2020-12) and
not committed; build them before generating code. For a Python worker,
generate pydantic models with
[datamodel-code-generator](https://github.com/koxudaxi/datamodel-code-generator):

```sh
pnpm --filter @repo/events build
datamodel-codegen \
  --input packages/events/dist/schemas/email.verify-email.v1.json \
  --input-file-type jsonschema \
  --output-model-type pydantic_v2.BaseModel \
  --output workers/python/models/verify_email.py
```

## Topology

Declared idempotently on every (re)connect by everyone who uses it
(`apps/worker/src/messaging/topology.ts`, from the constants in
`packages/events/src/topology.ts`). RabbitMQ refuses a redeclaration whose
arguments differ (`PRECONDITION_FAILED … inequivalent arg`), so other
languages must use exactly the arguments in `topology.json`.

| Name                | Kind           | Arguments                                                     | Purpose                                                                |
| ------------------- | -------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `vulnscan.jobs`     | topic exchange | durable                                                       | producers publish here with the message `type` as routing key          |
| `<queue>`           | quorum queue   | `x-delivery-limit: 5`, dead-letter to `""` / `<queue>.parked` | work queue, bound to its patterns (`email` ← `email.#`)                |
| `<queue>.retry.<n>` | quorum queue   | dead-letter to `""` / `<queue>`                               | holds the n-th retry until its per-message TTL (`expiration`) runs out |
| `<queue>.parked`    | quorum queue   | —                                                             | messages that won't be retried, for inspection or replay               |

There's one retry queue per attempt (`n` = 1 … number of delays) so that
messages in one queue all have the same delay; a per-message TTL only
expires at the head of a queue. The delays come from the consumer's
`JOB_RETRY_DELAYS_MS` (default `10000,60000,300000`), not from queue
arguments, so changing them doesn't change the topology.

## Consuming

`JobConsumer` (`apps/worker/src/messaging/job-consumer.ts`), per queue:

1. Manual acks with a prefetch of 10 (messages in flight per consumer).
2. Parse the body and validate the envelope; look up the handler for
   `type` + `version`; validate the full message against its schema.
   Anything that fails is **parked at once** (`invalid-message`,
   `unknown-type`, `invalid-data`).
3. Run the handler. Resolves → ack.
4. Throws `ParkJobError(reason)` → park (`permanent-failure`,
   `unknown-outcome`).
5. Throws anything else → republish to `<queue>.retry.<n>` with
   `expiration` = the n-th delay and header `retry-count: n`, then ack the
   original. When it expires it's dead-lettered back to the work queue.
   After the last delay it's parked (`retries-exhausted`).
6. Republishing uses publisher confirms; the original is acked only after the
   broker confirms the copy. If that publish fails, the original is nacked
   and requeued; the queue's delivery limit parks a message that keeps
   bouncing (or whose consumer keeps crashing).

Headers set by consumers: `retry-count`, `parked-reason`, `last-error`.
Broker headers (`x-death`, `x-delivery-count`, …) are dropped on republish.

A failing message never blocks others: it leaves the work queue while it
waits.

### Idempotency

Delivery is at least once (a crash before the ack redelivers), so handlers
must be idempotent. The email handlers (through
`EmailDeliveryService.sendOnce`) claim the message id in the
`email_delivery` table before sending and mark it sent after, so a duplicate
is skipped; a send that fails releases the claim for the retry. A claim
that's still `sending` after 10 minutes means an earlier attempt died
mid-send; that message is parked as `unknown-outcome` rather than risking a
second email. See `apps/worker/src/email/email-delivery.service.ts`.

## Parked messages

Look in the management UI (Queues → `email.parked` → Get messages) for the
body and the `parked-reason` / `last-error` headers. To replay one after
fixing the cause, publish its body again to `vulnscan.jobs` with its `type` as
routing key (the UI's "Publish message" on the exchange), or use a shovel.
Delivery deduplication still applies, so replaying an email that was sent is
harmless.

## Trying it locally

With `script/server` running, sign up at http://localhost:3000/sign-up: the
api publishes an `email.verify-email` job, the worker sends it, and it shows
up in Mailpit at http://localhost:8025. The tests cover the same path:

- `pnpm --filter worker test:integration` sends the email against real
  Postgres, RabbitMQ, and Mailpit (`test/email/`), and covers retries and
  parking.
- `pnpm --filter e2e test:e2e -g "signs up"` signs up in a browser and opens
  the link from Mailpit.

## Adding a job type

1. In `packages/events/src/<area>/<name>.ts`, define the `data` schema and
   `defineMessage("<area>.<name>", 1, dataSchema)`; export it from
   `src/index.ts` and add it to `messageDefinitions` (that's what the JSON
   Schema export iterates).
2. New area? Add a queue to `jobQueues` in `src/topology.ts`
   (`{ name: "scan", bindings: ["scan.#"] }`).
3. Consumer in the Nest worker: a class implementing `JobHandler`
   (`message` + `handle`), registered with
   `amqp.addConsumer({ queue, handlers: [...] })` in its module's
   `onApplicationBootstrap` (see `apps/worker/src/email/email.module.ts`).
   Make it idempotent.
4. Producer: inject `JobPublisher` and
   `publisher.publish(definition, createMessage(definition, data))`. If the
   decision to publish must survive a crash, record the state it reports
   and publish in one transaction (a refused publish rolls back), or write
   the message to an outbox table in that transaction and publish from
   there.
5. Add integration tests under `apps/worker/test/` and a row to the message
   types table above.

### A worker in another language

Follow the same contract: declare the topology with the arguments from
`topology.json` (or only check that it exists), consume the work queue with
manual acks and a prefetch, validate bodies against the generated models,
and implement the retry steps above: republish to `<queue>.retry.<n>` with
`expiration` and `retry-count`, or to `<queue>.parked` with `parked-reason`,
then ack. Deduplicate on the envelope `id`.
