/**
 * Single source of truth for admin nav and breadcrumb labels.
 * Add or edit routes here so AdminNav and AdminBreadcrumb stay in sync.
 */

import type { AdminRole } from "@/lib/types";

export type AdminNavIconKey =
  | "LayoutDashboard"
  | "FileText"
  | "BookMarked"
  | "History"
  | "FolderOpen"
  | "ShoppingBag"
  | "Tag"
  | "CreditCard"
  | "Shield"
  | "Users"
  | "Settings"
  | "Activity"
  | "Wrench"
  | "ServerCog";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminNavIconKey;
  roles: AdminRole[];
};

export type AdminNavGroup = {
  label: string;
  icon: AdminNavIconKey;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "",
    icon: "LayoutDashboard",
    items: [{ href: "/admin", label: "Tổng quan", icon: "LayoutDashboard", roles: ["super_admin"] }],
  },
  {
    label: "Nội dung",
    icon: "FolderOpen",
    items: [
      { href: "/admin/documents", label: "Tài liệu", icon: "FileText", roles: ["super_admin", "content_manager"] },
      { href: "/admin/categories", label: "Danh mục", icon: "BookMarked", roles: ["super_admin", "content_manager"] },
      { href: "/admin/documents/bulk-history", label: "Lịch sử bulk", icon: "History", roles: ["super_admin", "content_manager"] },
    ],
  },
  {
    label: "Bán hàng",
    icon: "CreditCard",
    items: [
      { href: "/admin/orders", label: "Đơn hàng", icon: "ShoppingBag", roles: ["super_admin"] },
      { href: "/admin/coupons", label: "Mã giảm giá", icon: "Tag", roles: ["super_admin"] },
    ],
  },
  {
    label: "Hệ thống",
    icon: "ServerCog",
    items: [
      { href: "/admin/security", label: "An ninh", icon: "Shield", roles: ["super_admin"] },
      { href: "/admin/users", label: "Khách hàng", icon: "Users", roles: ["super_admin", "support_agent"] },
      { href: "/admin/webhooks", label: "Webhooks", icon: "Settings", roles: ["super_admin"] },
      { href: "/admin/observability", label: "Observability", icon: "Activity", roles: ["super_admin"] },
      { href: "/admin/tools", label: "Công cụ", icon: "Wrench", roles: ["super_admin"] },
    ],
  },
];

const OVERVIEW_LABEL = "Tổng quan";
const ADMIN_ROOT_LABEL = "Admin";
const DETAIL_LABEL = "Chi tiết";

/**
 * Build segment -> label map for breadcrumb. Uses ADMIN_NAV_GROUPS so one config drives both nav and breadcrumb.
 */
export function getAdminSegmentLabels(): Record<string, string> {
  const map: Record<string, string> = {
    admin: ADMIN_ROOT_LABEL,
  };
  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      const path = item.href.replace(/^\/admin\/?/, "").trim();
      if (!path) continue;
      const segments = path.split("/");
      const last = segments[segments.length - 1];
      if (last) map[last] = item.label;
      if (segments.length > 1) {
        segments.slice(0, -1).forEach((seg) => {
          if (seg && !(seg in map)) map[seg] = seg;
        });
      }
    }
  }
  return map;
}

/** Label for the root admin page when path is exactly /admin */
export function getAdminOverviewLabel(): string {
  return OVERVIEW_LABEL;
}

/** Label for a detail page (segment is UUID) */
export function getAdminDetailLabel(): string {
  return DETAIL_LABEL;
}
