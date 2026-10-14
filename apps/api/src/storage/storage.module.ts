import { Module, type Provider } from "@nestjs/common";
import { env } from "@repo/config/api";
import { createObjectStorage, ObjectStorage } from "@repo/storage";

/**
 * Provides `ObjectStorage` when `STORAGE_DRIVER` is set, and nothing
 * otherwise, so the api still runs where no bucket is set up. Inject it with
 * `@Optional()`.
 */
function storageProviders(): Provider[] {
  const driver = env.STORAGE_DRIVER;
  if (!driver) return [];
  const bucket = env.GCS_BUCKET;
  if (!bucket) {
    throw new Error(`GCS_BUCKET is required when STORAGE_DRIVER is ${driver}.`);
  }
  return [
    {
      provide: ObjectStorage,
      useFactory: () =>
        createObjectStorage({
          driver,
          bucket,
          apiEndpoint: env.GCS_API_ENDPOINT,
          projectId: env.GCS_PROJECT_ID,
          credentials: env.GCS_CREDENTIALS,
        }),
    },
  ];
}

const providers = storageProviders();

@Module({ providers, exports: providers })
export class StorageModule {}
