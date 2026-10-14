import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { brand } from "@/lib/brand";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RetryButton } from "@/containers/offline/retry-button";

export const metadata: Metadata = { title: "Offline" };

/**
 * What the service worker (public/sw.js) shows when a page can't be loaded
 * from the network. Static, and outside the `(app)` and `(auth)` groups, so
 * it can be cached at install time and holds no user data.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <Logo />
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="items-center text-center">
            <WifiOff className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-xl">You&apos;re offline</CardTitle>
            <CardDescription>
              {brand.name} needs a connection. Check your signal or Wi-Fi and
              try again.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <RetryButton />
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
