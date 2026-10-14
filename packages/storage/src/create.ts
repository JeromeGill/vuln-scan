import type { GcsStorageOptions } from "./drivers/gcs.js";
import type { ObjectStorage } from "./object-storage.js";

/** Which driver to build, with its settings. Add a member per provider. */
export type StorageOptions = { driver: "gcs" } & GcsStorageOptions;

/**
 * Builds the driver named by `options.driver`. Drivers are imported lazily,
 * so a provider's client library only loads when it's selected.
 */
export async function createObjectStorage(
  options: StorageOptions,
): Promise<ObjectStorage> {
  switch (options.driver) {
    case "gcs": {
      const { GcsObjectStorage } = await import("./drivers/gcs.js");
      return GcsObjectStorage.create(options);
    }
  }
}
