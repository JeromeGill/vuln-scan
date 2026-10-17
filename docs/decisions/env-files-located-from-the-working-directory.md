# Env files located from the working directory

`@repo/config` originally resolved `.env` relative to its own file
(`import.meta.url`). That breaks once Next.js bundles it into server
components, so it walks up from `process.cwd()` to `pnpm-workspace.yaml`
instead. Every entry point (api, tests, scripts, `next dev`) runs inside the
repo, so this finds the same root.
