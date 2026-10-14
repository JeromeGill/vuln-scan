import { appIcon } from "@/lib/app-icon";

// Browser tab icon, next to app/favicon.ico for browsers that prefer a PNG.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return appIcon({ size: size.width, rounded: true, scale: 0.7 });
}
