// The Railway project for the dev deployment (docs/deployment.md): every
// service's build, start, and pre-deploy commands and every variable. Applied
// by the release workflow before it deploys (`railway config apply`); preview
// a change with `npx @railway/cli config plan`.
//
// This file owns the whole environment: apply deletes any resource missing
// from `resources` and any variable missing from a service's `env`.
// Destructive changes need `--confirm-destructive`, which the release
// workflow doesn't pass. Secrets are `preserve()`: their values are set in the
// Railway dashboard and never live in the repo. Values Railway resolves at
// runtime use its `${{service.VAR}}` syntax.
//
// Which project, repo, and bucket it targets comes from the environment, so
// none of them is committed (docs/deployment.md#the-railway-project-as-code):
// RAILWAY_PROJECT_NAME, RAILWAY_GITHUB_REPO (`owner/name`; GitHub Actions'
// GITHUB_REPOSITORY when unset), and optionally RAILWAY_GCS_BUCKET. This file
// isn't app code, so it reads process.env itself rather than @repo/config.
import {
  defineRailway,
  github,
  group,
  image,
  postgres,
  preserve,
  project,
  service,
  volume,
  type BuildConfig,
} from "railway/iac";

/** A variable this file can't be applied without. */
function required(name: string, value = process.env[name]): string {
  if (!value) {
    throw new Error(
      `${name} is not set: see docs/deployment.md#the-railway-project-as-code.`,
    );
  }
  return value;
}

const PROJECT_NAME = required("RAILWAY_PROJECT_NAME");
const GITHUB_REPO = required(
  "RAILWAY_GITHUB_REPO",
  process.env.RAILWAY_GITHUB_REPO || process.env.GITHUB_REPOSITORY,
);
/** The api's bucket (infra/); unset, the api runs without storage. */
const GCS_BUCKET = process.env.RAILWAY_GCS_BUCKET || undefined;

const API_PORT = "3002";
const WEB_ORIGIN = "https://${{web.RAILWAY_PUBLIC_DOMAIN}}";

/**
 * A Railpack build from the repo root. Watch paths stay empty: deploys come
 * from `railway up`, which has no git diff, so with watch paths set Railway
 * would skip the build.
 */
function appBuild(app: string): BuildConfig {
  return {
    buildCommand: `pnpm exec turbo build --filter=${app}`,
    builder: "RAILPACK",
    buildEnvironment: "V3",
    watchPatterns: [],
  };
}

export default defineRailway(() => {
  // Releases deploy with `railway up` from CI; automatic deploys from this
  // repo are disabled on each service.
  const repo = github(GITHUB_REPO, { branch: "main" });

  const Postgres = postgres("Postgres", { region: "sfo" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region: "sfo",
    sizeMB: 5000,
  });

  // From Railway's RabbitMQ template, with a proxy for its management UI.
  const rabbitmqVolume = volume("rabbitmq-volume", {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region: "sfo",
    sizeMB: 5000,
  });
  const RabbitMQ = service("RabbitMQ", {
    source: image("rabbitmq:management"),
    start:
      '/bin/sh -c "CONFIG_PATH=/etc; SYSTEM_FILE=hosts; echo 127.0.0.1 rabbitmq >> ${CONFIG_PATH}/${SYSTEM_FILE} && echo management.tcp.ip = :: >> /etc/rabbitmq/conf.d/10-defaults.conf && docker-entrypoint.sh rabbitmq-server"',
    replicas: { sfo: 1 },
    networking: {
      privateNetworkEndpoint: "rabbitmq",
      tcpProxies: { "5672": {} },
    },
    volumeMounts: { "/var/lib/rabbitmq": rabbitmqVolume },
    env: {
      RABBITMQ_DEFAULT_PASS: preserve(),
      RABBITMQ_DEFAULT_USER: preserve(),
      RABBITMQ_NODENAME: preserve(),
      RABBITMQ_PRIVATE_URL: preserve(),
      RABBITMQ_URL: preserve(),
    },
  });
  const RabbitMQWebUI = service("RabbitMQ Web UI", {
    source: image("ghcr.io/brody192/railway-public-to-private-proxy"),
    replicas: { sfo: 1 },
    networking: { privateNetworkEndpoint: "rabbitmq-web-ui" },
    env: { PROXY_HOST: preserve(), PROXY_PORT: preserve() },
  });

  const database = {
    DB_HOST: Postgres.env.PGHOST,
    DB_PORT: Postgres.env.PGPORT,
    DB_USER: Postgres.env.PGUSER,
    DB_PASSWORD: Postgres.env.PGPASSWORD,
    DB_NAME: Postgres.env.PGDATABASE,
  };

  const api = service("api", {
    source: repo,
    build: appBuild("api"),
    start: "pnpm --filter api start",
    replicas: { sfo: 1 },
    env: {
      RAILPACK_NODE_VERSION: "24",
      // Syncs the schema on start; there are no migrations yet.
      NODE_ENV: "development",
      PORT: API_PORT,
      ...database,
      BETTER_AUTH_SECRET: preserve(),
      // The web origin: the browser reaches Better Auth through web's proxy.
      BETTER_AUTH_URL: WEB_ORIGIN,
      WEB_URL: WEB_ORIGIN,
      // Publishes verification email jobs for the worker.
      RABBITMQ_URL: RabbitMQ.env.RABBITMQ_PRIVATE_URL,
      // Google sign-in: the dev project's OAuth client (docs/auth.md).
      GOOGLE_CLIENT_ID: preserve(),
      GOOGLE_CLIENT_SECRET: preserve(),
      // Object storage: the dev bucket from infra/envs/dev, when
      // RAILWAY_GCS_BUCKET names it. The key (a service account key's JSON)
      // is set with gcloud, see docs/infrastructure.md#the-service-account-key.
      ...(GCS_BUCKET
        ? { STORAGE_DRIVER: "gcs", GCS_BUCKET, GCS_CREDENTIALS: preserve() }
        : {}),
    },
  });

  const worker = service("worker", {
    source: repo,
    build: appBuild("worker"),
    start: "pnpm --filter worker start",
    replicas: { sfo: 1 },
    env: {
      RAILPACK_NODE_VERSION: "24",
      ...database,
      RABBITMQ_URL: RabbitMQ.env.RABBITMQ_PRIVATE_URL,
      WEB_URL: WEB_ORIGIN,
      // Resend (docs/deployment.md#email). SMTP_URL holds the API key:
      // smtps://resend:<api key>@smtp.resend.com:2465 (Railway blocks 465 and
      // 587). MAIL_FROM must use the
      // domain verified in Resend. The worker refuses to start without them.
      SMTP_URL: preserve(),
      MAIL_FROM: preserve(),
    },
  });

  const web = service("web", {
    source: repo,
    build: appBuild("web"),
    start: "pnpm --filter web start",
    replicas: { sfo: 1 },
    env: {
      RAILPACK_NODE_VERSION: "24",
      // Read when web is built (the rewrites in next.config.ts).
      API_URL: `http://\${{api.RAILWAY_PRIVATE_DOMAIN}}:${API_PORT}`,
      // "true" shows the Google button; set it once the api has the
      // Google credentials.
      GOOGLE_SIGN_IN: preserve(),
    },
  });

  return project(PROJECT_NAME, {
    resources: [
      worker,
      api,
      web,
      Postgres,
      rabbitmqVolume,
      postgresVolume,
      group("RabbitMQ", [RabbitMQWebUI, RabbitMQ]),
    ],
  });
});
