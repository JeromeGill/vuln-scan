import type {
  EnvironmentDto,
  ListEnvironmentsParams,
  Page,
} from "@repo/contracts";
import { deployments, lockfiles } from "../../data/lockfiles.js";
import type { ApiCase } from "../case.js";
import type { UploadRequest } from "../uploads/create.js";

const [production, staging, preview] = deployments.environments;
const [v14, v15, sha] = deployments.versions;
const [pnpmLock, packageLock] = lockfiles;

/**
 * The uploads every list case assumes, made in this order to one project:
 * production goes from v1.4.0 to v1.5.0, then gets a file added to v1.4.0,
 * which doesn't make it live again.
 */
export const listedUploads: UploadRequest[] = [
  {
    environment: production,
    version: v14,
    path: pnpmLock.path,
    file: pnpmLock.content,
  },
  {
    environment: staging,
    version: v14,
    path: pnpmLock.path,
    file: pnpmLock.content,
  },
  {
    environment: production,
    version: v15,
    path: pnpmLock.path,
    file: pnpmLock.content,
  },
  {
    environment: preview,
    version: sha,
    path: pnpmLock.path,
    file: pnpmLock.content,
  },
  {
    environment: production,
    version: v14,
    path: packageLock.path,
    file: packageLock.content,
  },
];

/**
 * An environment as the cases expect it: its name and live version (the
 * upload dates aren't known before the spec runs).
 */
export interface ListedEnvironment extends Pick<EnvironmentDto, "name"> {
  liveRelease: Pick<NonNullable<EnvironmentDto["liveRelease"]>, "version">;
}

/** `GET /projects/{projectId}/environments` of a project with `listedUploads`. */
export function listEnvironmentsCases(): ApiCase<
  Partial<ListEnvironmentsParams>,
  Page<ListedEnvironment>
>[] {
  return [
    {
      label:
        "S-0003 AC10: lists the project's environments by name with their live version",
      request: {},
      response: {
        items: [
          { name: preview, liveRelease: { version: sha } },
          { name: production, liveRelease: { version: v15 } },
          { name: staging, liveRelease: { version: v14 } },
        ],
        total: 3,
      },
    },
    {
      label: "returns the page that limit and offset select",
      request: { limit: 1, offset: 1 },
      response: {
        items: [{ name: production, liveRelease: { version: v15 } }],
        total: 3,
      },
    },
  ];
}
