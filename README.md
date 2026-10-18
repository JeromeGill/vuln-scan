# vulnscan

pnpm + Turborepo monorepo: a [Next.js](https://nextjs.org/) web app, a
[NestJS](https://nestjs.com/) api with [Better Auth](https://www.better-auth.com/)
and [TypeORM](https://typeorm.io/) on Postgres, and a NestJS worker consuming
[RabbitMQ](https://www.rabbitmq.com/) jobs, plus shared packages. The apps and
packages are described in [Architecture](docs/architecture.md), and each
package's own `README.md`.

## Quick start

Requires Node.js 24 (or `^22.22.3`), pnpm 12, and Docker.

```sh
script/bootstrap   # install dependencies and create .env files
script/server      # run Postgres, RabbitMQ, Mailpit, the api (:3002), the web app (:3000), and the worker
script/seed        # load the sample users
script/test        # run the test suites (-a=api, -a=web, -a=worker, or -a=e2e for one app)
```

## Started from a template

This repo was started from a template, whose placeholder names have been
renamed to `vulnscan`. Template updates are pulled from the `template` git
remote; when merging one, keep the new names in these places:

- **Display name:** `vulnscan` (was `My App`) in `apps/web/lib/brand.ts`
  (also the description and colours), the verification email
  (`apps/worker/src/email/templates/verify-email.tsx`) and the tests that
  check its subject, and `MAIL_FROM` in `.env.example`.
- **Identifiers:** `vulnscan` (was `app`) in the database, RabbitMQ, and
  bucket names (`.env.example`, `.env.test.example`, `docker-compose.yml`,
  `packages/config/src/*.ts`, `apps/e2e/settings.ts`,
  `packages/storage/test/gcs.integration.spec.ts`), the jobs exchange
  (`vulnscan.jobs`, `packages/events/src/topology.ts`), and the service
  worker's cache prefix (`apps/web/public/sw.js`); `vulnscan` (was
  `nest-template`) in the root `package.json`.
- **Deployment:** nothing to edit; set the GitHub Actions variables and each
  OpenTofu root's `terraform.tfvars` (see
  [Deployment](docs/deployment.md#first-deploy-checklist)).
- **The example route:** `GET /account` shows the wiring; keep or replace
  it. (`/dashboard` now lists vulnscan's projects.)

## Documentation

See [`docs/`](docs/README.md): [architecture](docs/architecture.md),
[development guide](docs/development.md), [testing](docs/testing.md),
[configuration](docs/configuration.md), [database](docs/database.md),
[messaging](docs/messaging.md), [authentication](docs/auth.md),
[decisions](docs/decisions/README.md), and
[troubleshooting](docs/troubleshooting.md).
