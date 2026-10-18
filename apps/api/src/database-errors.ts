import { QueryFailedError } from "typeorm";

/** Postgres error codes the services map to api errors. */
const UNIQUE_VIOLATION = "23505";

/** Whether `error` is Postgres rejecting a row for a unique constraint. */
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError: unknown = error.driverError;
  return (
    typeof driverError === "object" &&
    driverError !== null &&
    "code" in driverError &&
    driverError.code === UNIQUE_VIOLATION
  );
}
