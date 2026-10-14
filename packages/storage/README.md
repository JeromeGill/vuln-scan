# @repo/storage

Provider-neutral object storage: the `ObjectStorage` interface (put, get,
head, delete, delete by prefix, signed upload and download URLs),
`createObjectStorage(options)`, and one driver per provider (so far `gcs`,
run against the `fake-gcs-server` emulator locally). See `docs/storage.md`.

- **Used by:** the api (`apps/api/src/storage/`, not imported by any feature yet).
- **Depends on:** each driver's client library only (`@google-cloud/storage`,
  loaded only when that driver is created).
- **Doesn't contain:** Nest modules or config. An app wires it up with its
  own provider and passes the settings in.
