# nest-template

pnpm + Turborepo monorepo:

- `apps/web`: [Next.js](https://nextjs.org/) 16 app (React 19)
- `apps/api`: [NestJS](https://nestjs.com/) 12 server with
  [Better Auth](https://www.better-auth.com/) and
  [TypeORM](https://typeorm.io/) on Postgres
- `apps/worker`: NestJS 12 worker consuming [RabbitMQ](https://www.rabbitmq.com/)
  jobs (sends the verification emails)
- `@repo/config`: validated environment config for `api`, `web`, and `worker`
- `@repo/contracts`: oRPC route contracts (zod) shared by `api` and clients
- `@repo/entities`: TypeORM entities used by `api` and `worker`
- `@repo/events`: queue message schemas (zod, exported as JSON Schema)
- `@repo/fixtures`: sample data (users) for development
- `@repo/storage`: provider-neutral object storage (a GCS driver)
- `infra/`: OpenTofu for the GCP resources; `.railway/railway.ts`: the
  Railway deployment

## Quick start

Requires Node.js 24 (or `^22.22.3`), pnpm 12, and Docker.

```sh
script/bootstrap   # install dependencies and create .env files
script/server      # run Postgres, RabbitMQ, Mailpit, the api (:3002), the web app (:3000), and the worker
script/seed        # load the sample users
script/test        # run the test suites (-a=api, -a=web, -a=worker, or -a=e2e for one app)
```

## Starting a project from this template

The template uses placeholder names; replace them in the new repo:

- **Display name:** `My App` in `apps/web/lib/brand.ts` (also the
  description and colours), the verification email
  (`apps/worker/src/email/templates/verify-email.tsx`) and the tests that
  check its subject, and `MAIL_FROM` in `.env.example`.
- **Identifiers:** `app` in the database and RabbitMQ names (`.env.example`,
  `.env.test.example`, `docker-compose.yml`, `packages/config/src/*.ts`,
  `apps/e2e/settings.ts`), the jobs exchange (`app.jobs`,
  `packages/events/src/topology.ts`), and the service worker's cache prefix
  (`apps/web/public/sw.js`); `nest-template` in the root `package.json`.
- **Deployment:** nothing to edit; set the GitHub Actions variables and each
  OpenTofu root's `terraform.tfvars` (see
  [Deployment](docs/deployment.md#first-deploy-checklist)).
- **The example route:** `GET /account` and `/dashboard` show the wiring;
  keep or replace them.

## Documentation

See [`docs/`](docs/README.md): [architecture](docs/architecture.md),
[development guide](docs/development.md), [testing](docs/testing.md),
[configuration](docs/configuration.md), [database](docs/database.md),
[messaging](docs/messaging.md), [authentication](docs/auth.md),
[decisions](docs/decisions.md), and
[troubleshooting](docs/troubleshooting.md).
