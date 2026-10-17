# Env config package, loaded from repo-root files

`@repo/config` validates every variable with zod and loads the repo-root
`.env` files itself, so every app, test, and script sees the same values from
one place. `.env.test` holds only overrides and loads before `.env`.
