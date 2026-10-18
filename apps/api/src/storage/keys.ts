/**
 * Where the api keeps files in object storage. Everything of a project is
 * under `projectStoragePrefix`, so deleting the project deletes it all with
 * one `deletePrefix`. See docs/storage.md#key-layout.
 */

/** Every stored file of the project: `projects/<projectId>/`. */
export function projectStoragePrefix(projectId: string): string {
  return `projects/${projectId}/`;
}

/**
 * A lockfile:
 * `projects/<projectId>/environments/<environmentId>/releases/<releaseId>/lockfiles/<lockfileId>`.
 * Named by the lockfile's id rather than its path, which may hold
 * characters keys don't allow; uploading the same path again overwrites it.
 */
export function lockfileStorageKey(ids: {
  projectId: string;
  environmentId: string;
  releaseId: string;
  lockfileId: string;
}): string {
  return `${projectStoragePrefix(ids.projectId)}environments/${ids.environmentId}/releases/${ids.releaseId}/lockfiles/${ids.lockfileId}`;
}
