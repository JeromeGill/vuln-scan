# Locally, the GCS driver against fake-gcs-server

The first version had a `local` driver writing files to disk, with its own
HMAC-signed URLs served by an api route, plus a `memory` driver: about 850
lines with no user yet, and several concurrency and stream-handling bugs.
`fake-gcs-server` (a docker compose service) speaks the GCS API, so local
development and tests use the same `gcs` driver as production would, with
`GCS_API_ENDPOINT` set. In that mode the driver creates the bucket and signs
URLs with a throwaway key, because the emulator checks neither. What it
can't show is whether real GCS accepts the signatures and enforces the
signed size and type limits, which needs one manual check against a real
bucket (see [Storage](../storage.md)). The package has no Nest code: an app
that needs storage provides `ObjectStorage` with a factory calling
`createObjectStorage`, and none does until the first feature needs it, so no
app depends on the emulator before then.
