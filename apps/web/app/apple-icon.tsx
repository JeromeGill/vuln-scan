import { appIcon } from "@/lib/app-icon";

// iOS home screen icon. iOS rounds the corners itself and fills transparency
// with black, so this one is a full square.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon({ size: size.width, rounded: false, scale: 0.6 });
}
