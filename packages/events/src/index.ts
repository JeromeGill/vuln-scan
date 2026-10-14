import { verifyEmail } from "./email/verify-email.js";

export * from "./email/verify-email.js";
export * from "./envelope.js";
export * from "./topology.js";

/** Every message type, for consumers' registries and the JSON Schema export. */
export const messageDefinitions = [verifyEmail] as const;
