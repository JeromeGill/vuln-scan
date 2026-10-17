# Hand-written service worker

The PWA's worker is a ~140-line `apps/web/public/sw.js` rather than
Serwist. `@serwist/next` is a webpack plugin, and Next.js 16 builds with
Turbopack. `@serwist/turbopack` (9.5) works around that by bundling the
worker with esbuild inside a route handler at build time, which adds
`@swc/core`, esbuild (native or wasm), and `@serwist/build` to the web app,
build scripts pnpm would have to be allowed to run, and a dependency on
Next.js build internals. What it buys, precaching the whole build manifest,
isn't needed: the requirements are cache-first hashed assets, network
navigations with one offline fallback page, and never touching `/api`.
Versioning is done without a build step: `next.config.ts` picks a random
version per build, and the worker is registered as `/sw.js?v=<version>`
(the value reaches client code through `lib/build.ts`, the one place the
web app reads `process.env`). Each build installs a new worker, which
caches that build's offline page and drops the previous one. Hashed assets
share one unversioned cache, since a hashed URL never changes content, so
nothing is downloaded twice across builds; the cache is trimmed to its
newest entries on activate. Deriving the version from git was tried and
cost more (git at config load in every phase, uncommitted changes, CI
variables) than it saved. The new worker doesn't `skipWaiting`, so a
running app never swaps workers mid-session; it takes over on the next
launch.
Revisit if offline writes or push need Workbox-style routing, background
sync queues, or precaching (Serwist would then be worth its weight).
