"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Unlock, ChevronDown, Search } from "lucide-react";
import { formatDate } from "@/lib/date";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";
import { backfillMissingProfilesFromAuth, clearUserSecurityLock, grantDocumentPermission } from "@/app/admin/users/actions";

function riskLabel(r: number | null | undefined): string {
  if (r == null || Number.isNaN(Number(r))) return "";
  return ` (risk ${Number(r).toFixed(1)})`;
}

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  is_locked: boolean;
  lock_reason: string | null;
  risk_score: number | null;
  created_at: string;
}

export default function AdminUsersClient({
  profiles,
  revenueByUser,
  deviceCountByUser,
  profilesLoadError,
}: {
  profiles: Profile[];
  revenueByUser: Record<string, number>;
  deviceCountByUser: Record<string, number>;
  profilesLoadError?: string | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [unlockDocId, setUnlockDocId] = useState("");
  const [unlockUserId, setUnlockUserId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "locked" | "security_locked">("all");
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
        (statusFilter === "locked" && !p.is_active) ||
        (statusFilter === "security_locked" && Boolean(p.is_locked));
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

  async function unlockSecurity(userId: string) {
    const result = await clearUserSecurityLock(userId);
    if (result.ok) {
      toast.success("Đã mở khóa bảo mật (đọc tài liệu).");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function runBackfillFromAuth() {
    setBackfilling(true);
    const result = await backfillMissingProfilesFromAuth();
    setBackfilling(false);
    if (result.ok) {
      const n = result.data?.inserted ?? 0;
      toast.success(n > 0 ? `Đã tạo ${n} dòng profiles từ Auth.` : "Không thiếu dòng nào (hoặc đã đồng bộ).");
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
    {
      id: "status",
      header: "Trạng thái",
      cell: (p) => (
        <div className="flex flex-col gap-0.5">
          <span>{p.is_active ? "Hoạt động" : "Khóa (tài khoản)"}</span>
          {p.is_locked ? (
            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400" title={p.lock_reason ?? ""}>
              Khóa bảo mật{riskLabel(p.risk_score)}
            </span>
          ) : null}
        </div>
      ),
    },
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
      {profilesLoadError ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Lỗi tải profiles: {profilesLoadError}
        </div>
      ) : null}
      {profiles.length === 0 ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">Chưa có user trong bảng <span className="font-mono">profiles</span></p>
          <p className="mt-1 text-xs opacity-90">
            User trong Supabase Authentication vẫn cần một dòng tương ứng trong <span className="font-mono">public.profiles</span>. Bấm nút bên dưới để tạo bản ghi thiếu (cần đã chạy migration có hàm <span className="font-mono">backfill_missing_profiles</span>).
          </p>
          <button
            type="button"
            onClick={runBackfillFromAuth}
            disabled={backfilling}
            className="mt-3 rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-950 disabled:opacity-60 dark:bg-amber-700 dark:hover:bg-amber-600"
          >
            {backfilling ? "Đang đồng bộ…" : "Đồng bộ từ Auth → profiles"}
          </button>
        </div>
      ) : null}
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
        <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400">
          <strong>Khóa tài khoản</strong> (cột Hoạt động) dùng <span className="font-mono">is_active</span>.{" "}
          <strong>Khóa bảo mật</strong> (đọc PDF) dùng <span className="font-mono">is_locked</span> — có thể bật tự động khi điểm rủi ro cao; lọc bằng nút &quot;Khóa bảo mật&quot; phía trên.
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
          <button
            type="button"
            onClick={() => setStatusFilter("security_locked")}
            className={`rounded px-2 py-1 text-[11px] ${statusFilter === "security_locked" ? "bg-primary/10 font-semibold text-primary" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
            title="Khóa tự động (đọc PDF) — cột is_locked"
          >
            Khóa bảo mật
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
            {p.is_locked ? (
              <button
                type="button"
                onClick={() => unlockSecurity(p.id)}
                className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200"
              >
                Mở khóa bảo mật
              </button>
            ) : null}
          </>
        )}
        expandedRowId={expandedId}
        wrapperClassName="overflow-hidden rounded-xl border border-line bg-white dark:bg-slate-900"
      />
    </div>
  );
}
