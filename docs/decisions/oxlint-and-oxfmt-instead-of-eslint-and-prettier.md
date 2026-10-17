# oxlint and oxfmt instead of ESLint and Prettier

One root config each, run once over the repo; much faster. The shared
`@repo/eslint-config` and `@repo/typescript-config` packages were removed and
replaced by a root `tsconfig.base.json`. What was lost: the
`turbo/no-undeclared-env-vars` check (see
[Configuration](../configuration.md#adding-a-variable)).
