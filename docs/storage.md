# Object storage

`@repo/storage` (`packages/storage/`) stores files (uploads, scan
artifacts, …) behind one provider-neutral interface. The production provider isn't chosen yet; so far there is one
driver, `gcs`, which runs against the `fake-gcs-server` emulator locally.

## The interface

`ObjectStorage` (`src/object-storage.ts`) is an abstract class, so an app
can also use it as its Nest injection token. The package itself has no Nest
code:

- `putObject(key, body, { contentType })`, `getObject(key)` (a stream plus
  size and type; throws `ObjectNotFoundError`), `headObject(key)` (or
  null), `deleteObject(key)` (missing is fine), `deletePrefix(prefix)`;
- `createUploadUrl(key, { contentType, maxBytes, expiresInSeconds })` and
  `createDownloadUrl(key, { expiresInSeconds })`: signed URLs the browser
  uses directly, returned as `{ url, method, headers, expiresAt }`. Send
  exactly `headers` with the request.

Keys are `/`-separated paths like `widgets/{widgetId}/{fileId}/original`,
validated by every method (`src/keys.ts`): letters, digits, `.`, `_`, `-`;
no empty, `.`, or `..` segments; no leading or trailing `/`. Prefixes match
as plain strings, as in GCS and S3, so end one with `/` to mean a folder.

## In the api

The api is wired for storage, but no feature uses it yet; the worker
doesn't either.

- **Config** (`@repo/config/api`, see [Configuration](configuration.md)):
  `STORAGE_DRIVER` (`gcs`, the only driver so far), `GCS_BUCKET`,
  `GCS_API_ENDPOINT` (`http://localhost:4443` locally, the emulator),
  `GCS_PROJECT_ID`, and `GCS_CREDENTIALS` (a service account key's JSON;
  Application Default Credentials when unset). `.env.example` points at the
  emulator; the integration tests use their own bucket (`app-test`,
  `.env.test`) and the browser tests theirs (`app-e2e-test`).
- **Storage is optional.** `StorageModule` (`apps/api/src/storage/`)
  provides `ObjectStorage` only when `STORAGE_DRIVER` is set, so the api
  starts without a bucket. A feature imports `StorageModule` and injects
  `ObjectStorage` with `@Optional()`, answering 503 without it. With
  `STORAGE_DRIVER` set, a missing `GCS_BUCKET` stops startup, and the
  driver is built at startup, so locally the `fake-gcs` container must be
  running (`script/server` starts it).
- **Keys:** put each record's files under one prefix (e.g.
  `widgets/{widgetId}/{fileId}/original`), so deleting the record can delete
  its objects with `deletePrefix`. Deleting a user goes through Better
  Auth, so a feature storing per-user files needs its own cleanup.
- **Uploads** go straight from the browser to the bucket: the api signs a
  `PUT` URL for the content type with a size range, and on completion
  heads the object and checks its type and size itself, since the emulator
  enforces neither. Downloads are signed `GET` URLs.

## Locally: the emulator

`docker compose` runs [`fake-gcs-server`](https://github.com/fsouza/fake-gcs-server)
(service `fake-gcs`, port 4443, in memory, so objects are gone when the
container restarts). With `GCS_API_ENDPOINT` set, the `gcs` driver creates
the bucket if it's missing and signs URLs with a throwaway key, since the
emulator checks neither credentials nor signatures. No cloud account is
needed.

What the emulator doesn't do, and a real bucket must be checked for:

- verify V4 signatures, or enforce the signed content type and the
  `x-goog-content-length-range` size limit;
- restrict CORS. The emulator allows any origin; its
  `-cors-headers=x-goog-content-length-range` flag (docker-compose.yml)
  lets the browser send the signed size-range header. A real bucket needs
  CORS allowing the web origin (below).

## Production (when a provider is chosen)

The Railway dev deployment's bucket, CORS, and service account are
OpenTofu code (`infra/modules/media-bucket`); see
[Infrastructure](infrastructure.md). What follows is what that module sets
up, for any GCS bucket.

For GCS: a private bucket (uniform bucket-level access, public access
prevention on), and a service account with Storage Object Admin on the
bucket. Give the api its key as `GCS_CREDENTIALS` (the key file's JSON);
without credentials the client uses Application Default Credentials and
signs URLs through the IAM `signBlob` API, so the account would also need
Service Account Token Creator on itself. The bucket's CORS must allow the
web origin:

```json
[
  {
    "origin": ["https://<web domain>"],
    "method": ["PUT", "GET", "HEAD"],
    "responseHeader": ["Content-Type", "x-goog-content-length-range"],
    "maxAgeSeconds": 3600
  }
]
```

(`gcloud storage buckets update gs://<bucket> --cors-file=cors.json`).
Before relying on it, upload through a signed URL once and check that a
wrong content type and a too-large body are refused.

## Adding a provider

Write a driver class extending `ObjectStorage` in `src/drivers/`, add a
member to `StorageOptions` and a case to `createObjectStorage`
(`src/create.ts`, which imports drivers lazily), add the value to
`STORAGE_DRIVER` and its variables to the config, and
test it like `test/gcs.integration.spec.ts`, against an emulator if the
provider has one.
