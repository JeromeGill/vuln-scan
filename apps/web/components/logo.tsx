import { ShieldCheck } from "lucide-react";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

const sizes = {
  /** The app header: the name is for screen readers only on phones. */
  sm: {
    gap: "gap-2",
    tile: "size-7",
    icon: "size-4",
    text: "",
    name: "max-sm:sr-only",
  },
  /** Above the card on the standalone pages (auth, offline). */
  md: {
    gap: "gap-2",
    tile: "size-8",
    icon: "size-5",
    text: "text-lg",
    name: "",
  },
};

/** The app's mark and name. */
export function Logo({
  size = "md",
  className,
}: {
  size?: keyof typeof sizes;
  className?: string;
}) {
  const s = sizes[size];
  return (
    <span
      className={cn(
        "flex items-center font-semibold",
        s.gap,
        s.text,
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-md bg-primary text-primary-foreground",
          s.tile,
        )}
      >
        <ShieldCheck className={s.icon} />
      </span>
      <span className={s.name}>{brand.name}</span>
    </span>
  );
}
