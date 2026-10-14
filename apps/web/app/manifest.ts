import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

/** Web app manifest, served at /manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: brand.name,
    short_name: brand.name,
    description: brand.description,
    // `/` redirects to /dashboard when signed in and to /login otherwise.
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "en",
    // Manifests have no dark variant; the theme-color meta tags in the root
    // layout follow the theme once the app has loaded.
    background_color: brand.colors.light,
    theme_color: brand.colors.light,
    icons: [
      {
        src: "/icons/192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
