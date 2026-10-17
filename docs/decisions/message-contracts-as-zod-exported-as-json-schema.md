# Message contracts as zod, exported as JSON Schema

`@repo/events` defines a fixed envelope (`id`, `type`, `version`,
`occurredAt`, `data`) and one zod schema per message type. TypeScript
producers and consumers validate with zod; the build emits JSON Schema
(`z.toJSONSchema`) plus the topology as JSON for other languages to generate
models from. Bodies are JSON-only (ISO strings for dates). Breaking changes
bump `version`; consumers park versions they don't handle. Protobuf/Avro
were skipped: JSON is readable in the RabbitMQ UI and needs no schema
registry at this size.
