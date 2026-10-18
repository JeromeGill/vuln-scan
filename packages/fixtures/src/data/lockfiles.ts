/**
 * Sample lockfiles CI might upload: a path in the repository and the
 * file's contents (short, but in each format's real shape).
 */
export const lockfiles = [
  {
    path: "pnpm-lock.yaml",
    content: `lockfileVersion: '9.0'

importers:
  .:
    dependencies:
      express:
        specifier: ^4.21.0
        version: 4.21.0

packages:
  express@4.21.0:
    resolution: {integrity: sha512-VqcNGcj/Id5ZT1LZ/cfihi3ttTn+NJmkli2eZADigjq29qTlWi/hAQ43t/VLPq8+UX06FCEx3ByOYet6ZFblng==}
`,
  },
  {
    path: "apps/web/package-lock.json",
    content: `${JSON.stringify(
      {
        name: "web",
        lockfileVersion: 3,
        packages: {
          "": { dependencies: { lodash: "^4.17.20" } },
          "node_modules/lodash": { version: "4.17.20" },
        },
      },
      null,
      2,
    )}\n`,
  },
  {
    path: "services/api/requirements.txt",
    content: "django==4.2.0\nrequests==2.31.0\n",
  },
  {
    path: "services/worker/poetry.lock",
    content: `[[package]]
name = "celery"
version = "5.3.4"
`,
  },
] as const satisfies readonly LockfileFixture[];

export interface LockfileFixture {
  path: string;
  content: string;
}

/** Environments CI uploads to, and versions it deploys. */
export const deployments = {
  environments: ["production", "staging", "preview.pr-128"],
  versions: ["v1.4.0", "v1.5.0", "3f9c2ab7d1e04c6b8a5f2e9d7c1b0a4f6e8d2c3b"],
} as const;
