/**
 * App identity shared by the web app manifest, the generated icons, and the
 * theme-color meta tags. Browsers need sRGB hex here, so the colours are the
 * hex equivalents of the neutral tokens in `app/globals.css`.
 */
export const brand = {
  name: "vulnscan",
  description: "Vulnerability monitoring for the lockfiles you deploy.",
  colors: {
    /** `--background` in light mode (oklch(1 0 0)). */
    light: "#ffffff",
    /** `--background` in dark mode (oklch(0.145 0 0)). */
    dark: "#0a0a0a",
    /** `--primary` in light mode (oklch(0.205 0 0)): the logo tile. */
    primary: "#171717",
    /** `--primary-foreground` in light mode (oklch(0.985 0 0)): the logo icon. */
    primaryForeground: "#fafafa",
  },
} as const;
