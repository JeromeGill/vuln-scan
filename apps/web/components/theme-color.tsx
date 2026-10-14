"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { brand } from "@/lib/brand";

const noSubscription = () => () => undefined;

/**
 * False on the server and during hydration, true after: React renders with
 * the server snapshot while hydrating, so this can't cause a mismatch.
 */
function useHydrated() {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

/**
 * The `theme-color` meta tags, which colour the installed app's status bar
 * (React hoists them into `<head>`). They follow the system theme, and
 * after hydration the theme picked in the header, when that isn't "system".
 * The server and the first client render can't know the picked theme, so
 * they both render the system pair.
 */
export function ThemeColor() {
  const { theme, resolvedTheme } = useTheme();
  const hydrated = useHydrated();

  // resolvedTheme is "light" or "dark" once hydrated; the check narrows its
  // type for brand.colors.
  if (
    hydrated &&
    theme !== "system" &&
    (resolvedTheme === "light" || resolvedTheme === "dark")
  ) {
    return <meta name="theme-color" content={brand.colors[resolvedTheme]} />;
  }
  return (
    <>
      <meta
        name="theme-color"
        media="(prefers-color-scheme: light)"
        content={brand.colors.light}
      />
      <meta
        name="theme-color"
        media="(prefers-color-scheme: dark)"
        content={brand.colors.dark}
      />
    </>
  );
}
