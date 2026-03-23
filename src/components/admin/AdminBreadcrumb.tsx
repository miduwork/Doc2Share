"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  getAdminSegmentLabels,
  getAdminOverviewLabel,
  getAdminDetailLabel,
} from "@/lib/admin/nav-config";

function isUuid(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
}

export default function AdminBreadcrumb() {
  const pathname = usePathname();
  if (!pathname?.startsWith("/admin")) return null;

  const segments = pathname.split("/").filter(Boolean); // ['admin', ...]
  if (segments.length === 0 || segments[0] !== "admin") return null;

  const segmentLabels = getAdminSegmentLabels();

  const crumbs: { href: string | null; label: string }[] = [
    { href: "/admin", label: segmentLabels.admin ?? "Admin" },
  ];

  if (segments.length === 1) {
    crumbs.push({ href: null, label: getAdminOverviewLabel() });
  }

  let href = "/admin";
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    if (isUuid(seg)) {
      crumbs.push({ href: null, label: getAdminDetailLabel() });
      break;
    }
    const label = segmentLabels[seg] ?? seg;
    href += `/${seg}`;
    crumbs.push({ href: isLast ? null : href, label });
    if (isLast) break;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="admin-breadcrumb mb-2 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400"
    >
      {crumbs.map((crumb, idx) => (
        <span key={idx} className="flex items-center gap-1">
          {idx > 0 && (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
          )}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="admin-breadcrumb-link font-medium transition-colors hover:text-primary-600 dark:hover:text-primary-400"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="font-medium text-slate-700 dark:text-slate-300" aria-current="page">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
