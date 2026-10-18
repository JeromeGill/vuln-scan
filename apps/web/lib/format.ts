const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** A date as the user's locale writes it, e.g. "Oct 18, 2026". */
export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

/**
 * A date and time as the user's locale writes them, e.g.
 * "Oct 18, 2026, 3:04 PM".
 */
export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}
