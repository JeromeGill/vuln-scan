import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

/**
 * The app logo (lucide's `ShieldCheck` on a primary-coloured tile, as in the
 * header) rendered to a PNG. lucide-react's components read React context,
 * which `ImageResponse` can't render, so the icon's paths are copied here.
 *
 * - `rounded`: transparent rounded corners, for browser tabs and the
 *   manifest's `any` icons. Leave it off for icons the platform masks
 *   itself (maskable, Apple touch icon).
 * - `scale`: the icon's width as a share of the image. Maskable icons keep it
 *   inside the central 80% safe zone.
 */
export function appIcon({
  size,
  rounded,
  scale,
}: {
  size: number;
  rounded: boolean;
  scale: number;
}) {
  const icon = Math.round(size * scale);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: brand.colors.primary,
        borderRadius: rounded ? size * 0.22 : 0,
      }}
    >
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke={brand.colors.primaryForeground}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
