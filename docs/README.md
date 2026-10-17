# Docs

Project documentation. Read the relevant pages before starting work, and update
them in the same change when you alter what they describe (see
[Maintaining these docs](#maintaining-these-docs)).

| Page                                  | Read it when…                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| [Architecture](architecture.md)       | you need the big picture: apps, packages, how a request flows                    |
| [Development guide](development.md)   | setting up, running the app, or doing a common task (new entity, env var…)       |
| [Testing](testing.md)                 | running or writing tests                                                         |
| [Configuration](configuration.md)     | adding or changing an environment variable                                       |
| [Database](database.md)               | touching entities, schemas, or the database setup                                |
| [API contracts](contracts.md)         | adding or changing api routes, request bodies, or query params                   |
| [Web app](web.md)                     | working on the UI: pages, tables, forms, shadcn, the api client                  |
| [Authentication](auth.md)             | working on sign-up/login, sessions, or protected routes                          |
| [Messaging](messaging.md)             | adding a background job, a message type, or a worker (any language)              |
| [Storage](storage.md)                 | storing files: drivers, signed URLs, local files, GCS in production              |
| [Deployment](deployment.md)           | deploying to Railway, releasing, installing the app on a phone                   |
| [Infrastructure](infrastructure.md)   | changing GCP resources (the bucket) with OpenTofu in `infra/`                    |
| [Stories](stories/README.md)          | starting a feature or fix, or asking what a feature is meant to do               |
| [Plans](plans/README.md)              | the work is bigger or less certain than one story (new platform, new test layer) |
| [Glossary](glossary.md)               | naming things, or reading a story: what the app's words mean                     |
| [Decisions](decisions/README.md)      | wondering why something is done a non-obvious way                                |
| [Troubleshooting](troubleshooting.md) | something fails in a way you didn't expect                                       |

New here? Read [Architecture](architecture.md), then the setup section of the
[Development guide](development.md).

## Maintaining these docs

- Docs describe the code as it is. When a change makes a page wrong (renamed
  file, new script, different behaviour), fix the page in the same commit.
- Add a [decision](decisions/README.md) entry when you choose something a future
  reader would otherwise question or undo.
- Add a [troubleshooting](troubleshooting.md) entry when you hit and solve a
  confusing failure.
- Keep pages about _how and why_; don't paste code that is easy to read in the
  source. Link to files instead (`apps/api/src/database.ts`).
