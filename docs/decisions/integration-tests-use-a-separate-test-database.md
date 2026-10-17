# Integration tests use a separate `_test` database

Tests run against `app_test` on the same Postgres server. The global setup
creates it and refuses any database whose name doesn't end in `_test`. Test
cleanup deletes users, so this guard protects development data.
