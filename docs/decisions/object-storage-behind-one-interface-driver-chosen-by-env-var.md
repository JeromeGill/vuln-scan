# Object storage behind one interface, driver chosen by env var

The production storage provider isn't chosen, so `@repo/storage` defines a
small provider-neutral `ObjectStorage` (put, get, head, delete, delete by
prefix, signed upload and download URLs), and `STORAGE_DRIVER` picks the
driver when the app starts. So far there's one driver, `gcs`. Adding a
provider is a driver class and a config value; nothing else assumes GCS.
The interface stays to what GCS and S3 both do (string prefixes, signed
URLs with headers the client must send).
