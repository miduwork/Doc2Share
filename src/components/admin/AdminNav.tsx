"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Shield,
  Users,
  Settings,
  Tag,
  Wrench,
  Activity,
  ShoppingBag,
  History,
  BookMarked,
  FolderOpen,
  CreditCard,
  ServerCog,
} from "lucide-react";
import type { AdminRole } from "@/lib/types";
import { ADMIN_NAV_GROUPS, type AdminNavIconKey } from "@/lib/admin/nav-config";

const ICON_MAP: Record<AdminNavIconKey, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="h-4 w-4" />,
  FileText: <FileText className="h-4 w-4" />,
  BookMarked: <BookMarked className="h-4 w-4" />,
  History: <History className="h-4 w-4" />,
  FolderOpen: <FolderOpen className="h-4 w-4" />,
  ShoppingBag: <ShoppingBag className="h-4 w-4" />,
  Tag: <Tag className="h-4 w-4" />,
  CreditCard: <CreditCard className="h-4 w-4" />,
  Shield: <Shield className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  Settings: <Settings className="h-4 w-4" />,
  Activity: <Activity className="h-4 w-4" />,
  Wrench: <Wrench className="h-4 w-4" />,
  ServerCog: <ServerCog className="h-4 w-4" />,
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminNav({
  adminRole,
  mode = "sidebar",
}: {
  adminRole: AdminRole;
  mode?: "sidebar" | "inline";
}) {
  const pathname = usePathname();
  const inline = mode === "inline";

  const visibleGroups = ADMIN_NAV_GROUPS.map((g) => ({
    label: g.label,
    icon: ICON_MAP[g.icon],
    items: g.items
      .filter((i) => i.roles.includes(adminRole))
      .map((i) => ({ href: i.href, label: i.label, icon: ICON_MAP[i.icon], roles: i.roles })),
  })).filter((g) => g.items.length > 0);

  const linkClass = (href: string) => {
    const active = isActive(pathname, href);
    const base = "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition";
    if (inline) {
      return `${base} inline-flex ${active ? "border border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300" : "text-slate-600 hover:bg-white hover:shadow dark:text-slate-400 dark:hover:bg-slate-800"}`;
    }
    return `${base} ${active ? "admin-nav-active bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/80"}`;
  };

  if (inline) {
    return (
      <nav className="flex flex-wrap gap-1.5" aria-label="Admin menu">
        {visibleGroups.flatMap((g) =>
          g.items.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              {item.icon}
              {item.label}
            </Link>
          ))
        )}
      </nav>
    );
  }

  return (
    <nav className="mt-3 space-y-4" aria-label="Admin menu">
      {visibleGroups.map((group) => (
        <div key={group.label || "overview"}>
          {group.label ? (
            <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group.label}
            </p>
          ) : null}
          <ul className="space-y-0.5 text-xs">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass(item.href)}>
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
