# @repo/events

Queue message contracts: the JSON envelope, one zod schema per message type,
and the RabbitMQ topology constants. The build also writes JSON Schema for
workers in other languages.

- **Used by:** whatever publishes or consumes jobs (`apps/worker`, and `apps/api`, which publishes).
- **Depends on:** zod only.
- **Doesn't contain:** broker connections or handlers; those live in the
  apps.
