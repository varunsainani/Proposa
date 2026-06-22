"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  PencilRuler,
  FileText,
  BookOpen,
  Settings,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { LangToggle } from "./lang-toggle";
import { ThemeToggle } from "./theme-toggle";

interface NavItem {
  href: string;
  key: "studio" | "quotes" | "catalog" | "settings" | "admin";
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/studio", key: "studio", icon: PencilRuler },
  { href: "/quotes", key: "quotes", icon: FileText },
  { href: "/catalog", key: "catalog", icon: BookOpen },
  { href: "/settings", key: "settings", icon: Settings },
  { href: "/admin", key: "admin", icon: ShieldCheck, adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on navigation.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="bg-paper flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[var(--border)] bg-surface md:flex">
        <Brand />
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="no-print fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-[var(--border)] bg-surface">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                onClick={() => setDrawerOpen(false)}
                className="mr-3 rounded-md p-1.5 text-faint hover:bg-[var(--surface-hover)] focus-ring"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenDrawer={() => setDrawerOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Brand() {
  const t = useTranslations("common");
  return (
    <Link
      href="/studio"
      className="flex items-center gap-2 px-5 py-5 focus-ring"
      aria-label={t("appName")}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary)] font-serif text-lg text-white">
        P
      </span>
      <span className="font-serif text-xl tracking-tight text-fg">{t("appName")}</span>
    </Link>
  );
}

function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <nav className="flex-1 space-y-1 px-3 py-2">
      {NAV.filter((item) => !item.adminOnly || user?.role === "ADMIN").map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-ring ${
              active
                ? "bg-ink-50 text-ink-700"
                : "text-muted hover:bg-[var(--surface-hover)] hover:text-fg"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}

function Topbar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const t = useTranslations("nav");
  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] px-4 backdrop-blur sm:px-6 lg:px-10">
      <button
        onClick={onOpenDrawer}
        className="rounded-md p-2 text-fg hover:bg-[var(--surface-hover)] focus-ring md:hidden"
        aria-label={t("menu")}
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1 md:hidden" />
      <div className="flex items-center gap-2">
        <LangToggle />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

function UserMenu() {
  const t = useTranslations("nav");
  const tRole = useTranslations("role");
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function onLogout() {
    setOpen(false);
    await logout();
    router.replace("/login");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-surface pl-1.5 pr-2 hover:bg-[var(--surface-hover)] focus-ring"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("account")}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-semibold text-white">
          {initials || "U"}
        </span>
        <ChevronDown className="h-4 w-4 text-faint" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-md border border-[var(--border)] bg-surface py-1 shadow-lg"
        >
          <div className="border-b border-[var(--border)] px-3 py-2.5">
            <p className="text-xs text-faint">{t("signedInAs")}</p>
            <p className="truncate text-sm font-medium text-fg">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <span className="mt-1.5 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
              {tRole(user.role)}
            </span>
          </div>
          <button
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-fg hover:bg-[var(--surface-hover)]"
          >
            <LogOut className="h-4 w-4 text-faint" aria-hidden />
            {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}
