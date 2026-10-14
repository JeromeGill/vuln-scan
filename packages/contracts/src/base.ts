import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Every contract starts from `base`, so all routes share these typed errors.
 * Validation failures are oRPC's built-in `BAD_REQUEST`.
 */
export const base = oc.errors({
  UNAUTHORIZED: { status: 401, message: "Sign in to continue." },
  NOT_FOUND: { status: 404, message: "Not found." },
  CONFLICT: { status: 409, message: "Already exists." },
});

/** `{id}` path parameter shared by single-resource routes. */
export const idParams = z.object({ id: z.uuid() });

/** Query parameters for paginated lists. */
export const paginationParams = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** A page of `item`s plus the total matching the query. */
export function paginated<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), total: z.number().int() });
}

/** What `paginated(item)` parses to. */
export interface Page<T> {
  items: T[];
  total: number;
}

/**
 * Calendar date without a time, `YYYY-MM-DD`. Response dates with a time use
 * `z.coerce.date()` so clients validating responses turn JSON strings back
 * into `Date`s.
 */
export const isoDate = z.iso.date();
