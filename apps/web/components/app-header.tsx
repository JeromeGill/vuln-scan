"use client";

import { LayoutDashboard, LogOut, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppHeader({ user }: { user: { name: string; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/dashboard"
          className="flex items-center pointer-coarse:min-h-11"
        >
          <Logo size="sm" />
        </Link>

        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                // The label is hidden on phones.
                aria-label={label}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground pointer-coarse:min-h-11 pointer-coarse:min-w-11",
                  active && "bg-muted font-medium text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* In the account menu on phones, where the navbar is full. */}
          <Button
            variant="ghost"
            size="icon"
            className="max-sm:hidden"
            aria-label="Toggle theme"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            <Sun className="dark:hidden" />
            <Moon className="hidden dark:block" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Account"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {user.name}
                </span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="sm:hidden"
                onSelect={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
              >
                <Sun className="dark:hidden" />
                <Moon className="hidden dark:block" />
                Toggle theme
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  await signOut();
                  router.push("/login");
                  router.refresh();
                }}
              >
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
