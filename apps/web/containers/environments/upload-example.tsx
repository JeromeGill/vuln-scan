"use client";

import { supportedLockfileNames, uploadsPath } from "@repo/contracts";
import { useId, useSyncExternalStore } from "react";
import { CopyButton } from "@/components/copy-button";

/** The CI secret the example reads the upload token from. */
export const tokenVariable = "VULNSCAN_TOKEN";

/**
 * The `curl` command that uploads a lockfile to `origin`'s
 * `POST /api/uploads` (proxied to the api's `POST /uploads`) with the
 * token in `$VULNSCAN_TOKEN`.
 */
export function uploadCommand(origin: string): string {
  return [
    "curl --fail-with-body \\",
    `  -H "Authorization: Bearer $${tokenVariable}" \\`,
    "  -F environment=production \\",
    '  -F "version=$(git rev-parse HEAD)" \\',
    "  -F path=pnpm-lock.yaml \\",
    "  -F file=@pnpm-lock.yaml \\",
    `  ${origin}/api${uploadsPath}`,
  ].join("\n");
}

const noSubscription = () => () => {};

/** This page's origin; `null` while rendering on the server. */
function useOrigin(): string | null {
  return useSyncExternalStore(
    noSubscription,
    () => window.location.origin,
    () => null,
  );
}

/**
 * How CI uploads a lockfile to this project: a `curl` command to copy, and
 * what its fields mean. The token comes from the Tokens section; it isn't
 * in the command, which is the same for every project.
 */
export function UploadExample() {
  const id = useId();
  const origin = useOrigin();

  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="space-y-1">
        <h2 id={id} className="text-lg font-semibold tracking-tight">
          Upload from CI
        </h2>
        <p className="text-sm text-muted-foreground">
          After each deploy, upload each of the app&apos;s lockfiles. Store a
          token from above in your CI&apos;s secrets as{" "}
          <code className="font-mono text-xs">{tokenVariable}</code>.
        </p>
      </div>
      {origin && (
        <div className="space-y-3 rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Command</p>
            <CopyButton text={uploadCommand(origin)} what="command" />
          </div>
          {/* Scrolls on its own on phones, rather than the page. */}
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">
            <code>{uploadCommand(origin)}</code>
          </pre>
        </div>
      )}
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        <dt>
          <code className="font-mono text-xs">environment</code>
        </dt>
        <dd className="text-muted-foreground">
          Where it&apos;s deployed: 1–64 lowercase letters, digits,{" "}
          <code>.</code>, <code>-</code> and <code>_</code>. The first upload to
          a name adds the environment.
        </dd>
        <dt>
          <code className="font-mono text-xs">version</code>
        </dt>
        <dd className="text-muted-foreground">
          What&apos;s deployed, e.g. a tag or commit. A new version becomes the
          environment&apos;s live one.
        </dd>
        <dt>
          <code className="font-mono text-xs">path</code>
        </dt>
        <dd className="text-muted-foreground">
          The file&apos;s path in the repository, ending in one of{" "}
          {supportedLockfileNames.join(", ")}.
        </dd>
      </dl>
    </section>
  );
}
