"use client";

import { useEffect } from "react";
import { build } from "@/lib/build";

/**
 * Registers public/sw.js in production builds. The `v` query changes with
 * every build (next.config.ts), which makes the browser install the new
 * worker; it takes over on the next launch.
 *
 * In development it removes any worker and every cache a production build
 * left on this origin, since cached assets would break hot reloading.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (!build.isProduction) {
      void unregisterAll();
      return;
    }
    navigator.serviceWorker
      .register(`/sw.js?v=${build.serviceWorkerVersion}`, {
        scope: "/",
        updateViaCache: "none",
      })
      .catch((error: unknown) => {
        console.warn("Service worker registration failed", error);
      });
  }, []);

  return null;
}

async function unregisterAll() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map((registration) => registration.unregister()),
  );
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}
