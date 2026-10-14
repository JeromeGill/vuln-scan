/**
 * Writes the message contracts as JSON Schema (draft 2020-12) for consumers
 * in other languages, plus the broker topology, into `dist/schemas/`. Runs as
 * part of `build`.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { z } from "zod";
import {
  envelopeSchema,
  jobHeaders,
  jobQueues,
  jobsExchange,
  messageDefinitions,
  parkedQueueName,
  parkedReasons,
  queueArguments,
  retryQueueName,
} from "../index.js";

const outDir = new URL("../schemas/", import.meta.url);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

function write(name: string, value: unknown) {
  writeFileSync(new URL(name, outDir), `${JSON.stringify(value, null, 2)}\n`);
}

write("envelope.json", {
  title: "Envelope",
  ...z.toJSONSchema(envelopeSchema),
});

for (const definition of messageDefinitions) {
  const title = definition.type
    .split(/[.-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  write(`${definition.type}.v${definition.version}.json`, {
    title: `${title}V${definition.version}`,
    ...z.toJSONSchema(definition.schema),
  });
}

write("topology.json", {
  exchange: jobsExchange,
  queues: jobQueues.map(({ name, bindings }) => ({
    name,
    bindings,
    arguments: queueArguments.work(name),
    retryQueues: {
      name: retryQueueName(name, 1).replace(/1$/, "{n}"),
      arguments: queueArguments.retry(name),
    },
    parkedQueue: {
      name: parkedQueueName(name),
      arguments: queueArguments.parked(),
    },
  })),
  headers: jobHeaders,
  parkedReasons,
});
