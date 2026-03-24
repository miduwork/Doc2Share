"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Unlock, ChevronDown, Search } from "lucide-react";
import { formatDate } from "@/lib/date";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";
import { grantDocumentPermission } from "@/app/admin/users/actions";

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminUsersClient({
  profiles,
  revenueByUser,
  deviceCountByUser,
}: {
  profiles: Profile[];
  revenueByUser: Record<string, number>;
  deviceCountByUser: Record<string, number>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [unlockDocId, setUnlockDocId] = useState("");
  const [unlockUserId, setUnlockUserId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "locked">("all");
  const router = useRouter();

  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      const matchQuery =
        !q ||
        (p.full_name ?? "").toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && p.is_active) ||
        (statusFilter === "locked" && !p.is_active);
      return matchQuery && matchStatus;
    });
  }, [profiles, query, statusFilter]);

  async function manualUnlock() {
    if (!unlockUserId?.trim() || !unlockDocId?.trim()) return;
    const result = await grantDocumentPermission(unlockUserId.trim(), unlockDocId.trim());
    if (result.ok) {
      setUnlockDocId("");
      setUnlockUserId("");
      toast.success("Đã cấp quyền.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const columns: AdminTableColumn<Profile>[] = [
    {
      id: "user",
      header: "User",
      cell: (p) => (
        <>
          <Link href={`/admin/users/${p.id}`} className="font-medium text-primary-600 hover:underline">
            {p.full_name || p.id.slice(0, 8) + "..."}
          </Link>
          <span className="ml-1.5 font-mono text-[10px] text-slate-500">{p.id.slice(0, 8)}...</span>
        </>
      ),
    },
    { id: "role", header: "Vai trò", cell: (p) => p.role },
    { id: "revenue", header: "Doanh thu", headerClassName: "text-right", cellClassName: "text-right", cell: (p) => `${(revenueByUser[p.id] ?? 0).toLocaleString("vi-VN")} ₫` },
    { id: "devices", header: "Thiết bị", headerClassName: "text-right", cellClassName: "text-right", cell: (p) => String(deviceCountByUser[p.id] ?? 0) },
    { id: "status", header: "Trạng thái", cell: (p) => (p.is_active ? "Hoạt động" : "Khóa") },
    {
      id: "expand",
      header: "",
      headerClassName: "w-8 px-2 py-1.5",
      cellClassName: "px-2 py-1.5",
      cell: (p) => (
        <button
          type="button"
          onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
          className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
          aria-expanded={expandedId === p.id}
          aria-label={expandedId === p.id ? "Thu gọn" : "Mở rộng"}
        >
          <ChevronDown className={`h-3.5 w-3.5 ${expandedId === p.id ? "rotate-180" : ""}`} />
        </button>
      ),
    },
  ];

  return (
    <div className="mt-4">
      <div className="premium-panel mb-4 rounded-xl p-3">
        <h2 className="text-xs font-semibold text-semantic-heading">Mở khóa thủ công</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">Cấp quyền xem tài liệu cho user (sau khi đã nhận tiền).</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[11px] text-slate-500">User ID</label>
            <input
              type="text"
              value={unlockUserId}
              onChange={(e) => setUnlockUserId(e.target.value)}
              placeholder="UUID"
              className="input-premium mt-0.5 w-56 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500">Document ID</label>
            <input
              type="text"
              value={unlockDocId}
              onChange={(e) => setUnlockDocId(e.target.value)}
              placeholder="UUID"
              className="input-premium mt-0.5 w-56 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={manualUnlock}
            className="btn-primary flex items-center gap-1 px-3 py-1.5 text-xs"
          >
            <Unlock className="h-3.5 w-3.5" />
            Cấp quyền
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          <strong>Lấy User ID:</strong> Bấm mũi tên ▼ bên cạnh user trong bảng để mở rồi bấm &quot;Dùng User ID này&quot;, hoặc vào chi tiết user (link tên) để xem ID. —
          <strong> Lấy Document ID:</strong> Từ URL cửa hàng <span className="font-mono">/cua-hang/[id]/...</span> (phần <span className="font-mono">[id]</span>), hoặc <Link href="/admin/documents" className="text-primary hover:underline">Admin → Tài liệu</Link> (cột ID).
        </p>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <div className="premium-panel flex items-center gap-1.5 rounded-lg px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc user id..."
            className="w-48 bg-transparent text-xs outline-none placeholder:text-slate-400 sm:w-56"
          />
        </div>
        <div className="premium-panel flex gap-0.5 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded px-2 py-1 text-[11px] ${statusFilter === "all" ? "bg-primary/10 font-semibold text-primary" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`rounded px-2 py-1 text-[11px] ${statusFilter === "active" ? "bg-primary/10 font-semibold text-primary" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
          >
            Hoạt động
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("locked")}
            className={`rounded px-2 py-1 text-[11px] ${statusFilter === "locked" ? "bg-primary/10 font-semibold text-primary" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
          >
            Đã khóa
          </button>
        </div>
      </div>

      <AdminTable<Profile>
        columns={columns}
        data={filteredProfiles}
        emptyMessage="Không có user phù hợp."
        getRowId={(p) => p.id}
        expandableRow={(p) => (
          <>
            Đăng ký: {formatDate(p.created_at)} · User ID: <span className="font-mono">{p.id}</span>
            <button
              type="button"
              onClick={() => setUnlockUserId(p.id)}
              className="ml-2 rounded bg-primary/10 px-2 py-0.5 font-medium text-primary hover:bg-primary/20"
            >
              Dùng User ID này
            </button>
          </>
        )}
        expandedRowId={expandedId}
        wrapperClassName="overflow-hidden rounded-xl border border-line bg-white dark:bg-slate-900"
      />
    </div>
  );
}
