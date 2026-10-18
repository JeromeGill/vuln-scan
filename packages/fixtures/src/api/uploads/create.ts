import type {
  supportedLockfileNames,
  UploadedLockfileDto,
  UploadLockfile,
} from "@repo/contracts";
import { deployments, lockfiles } from "../../data/lockfiles.js";
import type { ApiCase } from "../case.js";

const [production, staging, preview] = deployments.environments;
const [v14, v15, sha] = deployments.versions;
const [pnpmLock, packageLock, requirements, poetryLock] = lockfiles;

/**
 * An upload's multipart body: its fields, and the file's contents as
 * `file` (the spec attaches them under the path's file name). Not a `File`:
 * the fixtures don't load the DOM types it's declared in.
 */
export type UploadRequest = Omit<UploadLockfile, "file"> & { file: string };

/** An upload case, with the uploads to make before it. */
export interface CreateUploadCase extends ApiCase<
  UploadRequest,
  UploadedLockfileDto
> {
  /** Uploads to the same project first, in this order. */
  given: UploadRequest[];
}

/** Every file name an upload takes, each tried by a case. */
const fileNames = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "poetry.lock",
  "uv.lock",
  "Pipfile.lock",
  "requirements.txt",
] as const satisfies readonly (typeof supportedLockfileNames)[number][];

/**
 * `POST /uploads`, each case to a project of its own (with a token for
 * it). The spec also checks the stored file and the rows behind the
 * response.
 */
export function createUploadCases(): CreateUploadCase[] {
  const first = {
    environment: production,
    version: v14,
    path: pnpmLock.path,
    file: pnpmLock.content,
  };
  return [
    {
      label: "S-0003 AC1: stores the file and says where it went",
      given: [],
      request: first,
      response: {
        environment: production,
        version: v14,
        path: pnpmLock.path,
        live: true,
      },
    },
    {
      label: "S-0003 AC3: creates an environment for each name it hasn't seen",
      given: [first],
      request: { ...first, environment: staging },
      response: { environment: staging, live: true },
    },
    {
      label: "S-0003 AC4: makes a new version's release live",
      given: [first],
      request: { ...first, version: v15 },
      response: { version: v15, live: true },
    },
    {
      label: "S-0003 AC5: adds a file to the live release",
      given: [first],
      request: {
        ...first,
        path: requirements.path,
        file: requirements.content,
      },
      response: { version: v14, path: requirements.path, live: true },
    },
    {
      label:
        "S-0003 AC5: adds a file to an earlier release, which stays not live",
      given: [first, { ...first, version: v15 }],
      request: {
        ...first,
        path: packageLock.path,
        file: packageLock.content,
      },
      response: { version: v14, path: packageLock.path, live: false },
    },
    {
      label: "S-0003 AC5: replaces the file already at the path",
      given: [first],
      request: { ...first, file: `${pnpmLock.content}# replaced\n` },
      response: { version: v14, path: pnpmLock.path, live: true },
    },
    ...[
      { label: "a one-character name", environment: "a" },
      { label: "a name of 64 characters", environment: `p${"0".repeat(63)}` },
      { label: "a name with '.', '-' and '_'", environment: preview },
      { label: "a name starting with a digit", environment: "1st_eu-west" },
    ].map(({ label, environment }) => ({
      label: `S-0003 AC3: accepts ${label}`,
      given: [],
      request: { ...first, environment },
      response: { environment, live: true },
    })),
    ...[
      { label: "a commit SHA", version: sha },
      { label: "spaces and punctuation", version: "2026.10.18 (hotfix #2)" },
      { label: "characters beyond ASCII", version: "v2.0-größer-✓" },
      { label: "a one-character version", version: "7" },
      { label: "a version of 128 characters", version: "v".repeat(128) },
    ].map(({ label, version }) => ({
      label: `S-0003 AC6: accepts ${label}`,
      given: [],
      request: { ...first, version },
      response: { version, live: true },
    })),
    ...fileNames.map((name) => ({
      label: `S-0003 AC7: accepts ${name}`,
      given: [],
      request: { ...first, path: name },
      response: { path: name },
    })),
    {
      label: "S-0003 AC7: accepts a nested path",
      given: [],
      request: { ...first, path: poetryLock.path, file: poetryLock.content },
      response: { path: poetryLock.path },
    },
    {
      label: "S-0003 AC7: accepts a path of 255 characters",
      given: [],
      request: {
        ...first,
        path: `${"d/".repeat(120)}pnpm-lock.yaml`.padStart(255, "x"),
      },
      response: {
        path: `${"d/".repeat(120)}pnpm-lock.yaml`.padStart(255, "x"),
      },
    },
  ];
}
