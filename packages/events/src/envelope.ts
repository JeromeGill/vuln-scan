import { randomUUID } from "node:crypto";
import { z } from "zod";

/**
 * Every message on the queue is a JSON object with this shape. `type` is
 * also the routing key, and names the kind of job (`<area>.<name>`, lower
 * case, e.g. `email.verify-email`). `version` changes only
 * for breaking changes to `data`; consumers reject versions they don't know.
 *
 * Bodies use JSON types only (dates are ISO strings) so consumers in any
 * language can read them; see docs/messaging.md.
 */
export const envelopeSchema = z.object({
  /** Unique per message; consumers deduplicate on it. */
  id: z.uuid(),
  type: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/),
  version: z.int().positive(),
  /** When the producer created the message (ISO 8601 with offset). */
  occurredAt: z.iso.datetime({ offset: true }),
  data: z.unknown(),
});

export type Envelope = z.infer<typeof envelopeSchema>;

export interface MessageDefinition<
  Type extends string = string,
  Version extends number = number,
  Data extends z.ZodType = z.ZodType,
> {
  type: Type;
  version: Version;
  /** Schema of `data`. */
  data: Data;
  /** Schema of the whole message (envelope + data). */
  schema: z.ZodObject<{
    id: z.ZodUUID;
    type: z.ZodLiteral<Type>;
    version: z.ZodLiteral<Version>;
    occurredAt: z.ZodISODateTime;
    data: Data;
  }>;
}

/** Declares a message type: its name, version, and `data` schema. */
export function defineMessage<
  const Type extends string,
  const Version extends number,
  Data extends z.ZodType,
>(
  type: Type,
  version: Version,
  data: Data,
): MessageDefinition<Type, Version, Data> {
  envelopeSchema.shape.type.parse(type);
  return {
    type,
    version,
    data,
    schema: envelopeSchema.extend({
      type: z.literal(type),
      version: z.literal(version),
      data,
    }),
  };
}

/** The full message type of a definition. */
export type MessageOf<Definition extends MessageDefinition> = z.infer<
  Definition["schema"]
>;

/** Wraps `data` in an envelope, with a new id unless one is given. */
export function createMessage<Definition extends MessageDefinition>(
  definition: Definition,
  data: z.input<Definition["data"]>,
  options: { id?: string; occurredAt?: Date } = {},
): MessageOf<Definition> {
  // `definition.schema.parse` would be typed by the constraint's schema;
  // naming the type parameter keeps this definition's message type.
  return z.parse<Definition["schema"]>(definition.schema, {
    id: options.id ?? randomUUID(),
    type: definition.type,
    version: definition.version,
    occurredAt: (options.occurredAt ?? new Date()).toISOString(),
    data,
  });
}
