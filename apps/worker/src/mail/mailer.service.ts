export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Extra headers, e.g. `Reply-To`. */
  headers?: Record<string, string>;
}

/**
 * Sends an email. Resolves once the mail server has accepted it. Rejects
 * with `PermanentMailError` when retrying can't help (the server refused
 * the message or recipient), and with any other error otherwise.
 *
 * An abstract class rather than an interface so it can be the DI token;
 * tests swap in their own implementation.
 */
export abstract class MailerService {
  abstract send(email: Email): Promise<void>;
}

export class PermanentMailError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PermanentMailError";
  }
}
