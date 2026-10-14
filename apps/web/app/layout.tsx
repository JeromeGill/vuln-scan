import type { Metadata } from "next";
import localFont from "next/font/local";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
  // iOS: open "Add to Home Screen" bookmarks full screen, with an opaque
  // status bar coloured from the theme-color tags (components/theme-color.tsx).
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
  // Keep iOS from turning numbers and dates into phone or calendar links.
  formatDetection: { telephone: false, date: false, address: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // next-themes sets the theme class before hydration.
    <html
      lang="en"
      className={cn(geistSans.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-svh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
