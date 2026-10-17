# Better Auth tables in an `auth` schema

They were first prefixed (`ba_user`, …). They now live in a dedicated `auth`
schema under Better Auth's default names, which separates them from app
tables. Entity class names keep the `Ba` prefix to mark them as Better Auth's.
