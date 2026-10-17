# TypeScript held at 6.x

TypeScript 7.0 ships only the `tsc` executable, not the compiler API. The Nest
CLI (`nest build`, `nest start --watch`) and `@nestjs/schematics` (`nest g`)
need that API, and `@thallesp/nestjs-better-auth` declares TypeScript
`^5.9 || ^6` as a peer. The `^6` range holds it: `script/update` only updates
within ranges. `updateConfig.ignoreDependencies` in `pnpm-workspace.yaml`
isn't enough on its own, because pnpm 12's `pnpm update --recursive --latest`
upgraded TypeScript to 7 despite it.

**Revisit when TypeScript 7.1 ships the API again and Nest supports it.**
