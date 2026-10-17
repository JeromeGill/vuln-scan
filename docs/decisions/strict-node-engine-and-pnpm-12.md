# Strict Node engine and pnpm 12

`engineStrict: true` makes pnpm enforce the root `engines` range. That range
follows the strictest dependency (currently the Nest CLI's
`@angular-devkit/core`), so `script/bootstrap` doesn't check Node itself.
pnpm 12's default `minimumReleaseAge` (24h) is kept as supply-chain
protection.
