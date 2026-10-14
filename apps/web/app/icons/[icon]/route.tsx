import { notFound } from "next/navigation";
import { appIcon } from "@/lib/app-icon";

/**
 * The web app manifest's icons (app/manifest.ts), rendered at build time to
 * stable URLs: /icons/192.png, /icons/512.png, /icons/maskable-512.png.
 */
const icons = new Map([
  ["192.png", { size: 192, rounded: true, scale: 0.6 }],
  ["512.png", { size: 512, rounded: true, scale: 0.6 }],
  // Android crops maskable icons to a circle or squircle: no corners of our
  // own, and the icon inside the central 80% safe zone.
  ["maskable-512.png", { size: 512, rounded: false, scale: 0.5 }],
]);

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [...icons.keys()].map((icon) => ({ icon }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ icon: string }> },
) {
  const options = icons.get((await params).icon);
  if (!options) notFound();
  return appIcon(options);
}
