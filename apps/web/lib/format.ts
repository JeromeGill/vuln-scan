const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** A date as the user's locale writes it, e.g. "Oct 18, 2026". */
export function formatDate(date: Date): string {
  return dateFormat.format(date);
}
