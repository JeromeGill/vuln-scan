# Contract-first api with oRPC

Routes are declared as oRPC contracts in `@repo/contracts` before they're
implemented, so the api and its clients share typed inputs, outputs, and
errors, and OpenAPI can be generated from the same definitions. The schemas
are written in zod independently of the TypeORM entities: the HTTP shape can
differ from the table, and browser code can import contracts without pulling
in TypeORM. Response types are suffixed `Dto` to avoid clashing with entity
class names.
