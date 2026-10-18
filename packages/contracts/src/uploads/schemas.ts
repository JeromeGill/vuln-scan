import { z } from "zod";

/** The largest lockfile an upload takes: 20 MB. */
export const maxLockfileBytes = 20 * 1024 * 1024;

/**
 * The file names an upload's `path` may end in: the Node and Python
 * lockfiles vulnscan can scan.
 */
export const supportedLockfileNames = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "poetry.lock",
  "uv.lock",
  "Pipfile.lock",
  "requirements.txt",
] as const;

/**
 * An environment's name: 1–64 lowercase letters, digits, `.`, `-` and `_`,
 * starting with a letter or digit.
 */
export const environmentNameSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9._-]{0,63}$/,
    "Use 1–64 lowercase letters, digits, '.', '-' and '_', starting with a letter or digit.",
  );

/**
 * A release's version: any 1–128 printable characters (no control
 * characters), never interpreted or ordered.
 */
export const releaseVersionSchema = z
  .string()
  .regex(/^\P{C}{1,128}$/u, "Use 1–128 printable characters.");

/** The file name at the end of `path`. */
function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * Where the lockfile is in the repository: a relative path of at most 255
 * characters ending in a supported file name.
 */
export const lockfilePathSchema = z
  .string()
  .min(1, "Enter the file's path.")
  .max(255, "Use a path of at most 255 characters.")
  .refine(
    (path) => !path.startsWith("/") && !path.split("/").includes(".."),
    "Use a relative path, without a leading '/' or '..'.",
  )
  .refine(
    (path) => supportedLockfileNames.some((name) => name === fileName(path)),
    `Upload one of the supported files: ${supportedLockfileNames.join(", ")}.`,
  );

/**
 * Body of `POST /uploads`, multipart form data: the file and plain fields
 * saying where it's deployed.
 */
export const uploadLockfileSchema = z.object({
  environment: environmentNameSchema,
  version: releaseVersionSchema,
  path: lockfilePathSchema,
  /** At most `maxLockfileBytes`; a larger one is `PAYLOAD_TOO_LARGE`. */
  file: z.file(),
});

/** Response of `POST /uploads`: where the file was stored. */
export const uploadedLockfileSchema = z.object({
  environment: z.string(),
  version: z.string(),
  path: z.string(),
  /** Whether the upload's release is its environment's live one. */
  live: z.boolean(),
});

export type UploadLockfile = z.infer<typeof uploadLockfileSchema>;
export type UploadedLockfileDto = z.infer<typeof uploadedLockfileSchema>;
