# Storage is optional in the api

The production storage provider isn't chosen, and the deployed app must
keep working until a bucket exists. So `StorageModule` provides
`ObjectStorage` only when `STORAGE_DRIVER` is set; services inject it with
`@Optional()` and answer a 503 when it's missing. Making the config required
would have stopped the deployed api at startup until a bucket and its
credentials were set up. With `STORAGE_DRIVER` set, a missing bucket still
fails startup, so a half-configured api doesn't run.
