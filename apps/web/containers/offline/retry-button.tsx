"use client";

import { RotateCw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Reloads the page the user asked for: the service worker serves the offline
 * page in its place, so the address is still that page's. Opened directly
 * (/offline), it goes to the start page instead. Retries by itself when the
 * browser reports the connection is back.
 */
function retry() {
  if (window.location.pathname === "/offline") window.location.assign("/");
  else window.location.reload();
}

export function RetryButton() {
  useEffect(() => {
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  return (
    <Button className="w-full" size="lg" onClick={retry}>
      <RotateCw />
      Try again
    </Button>
  );
}
