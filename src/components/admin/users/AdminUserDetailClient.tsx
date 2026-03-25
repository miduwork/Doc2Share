"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Unlock, BookOpen, Smartphone, MessageSquare, Plus, Shield } from "lucide-react";
import { formatDate } from "@/lib/date";
import { getFriendlyDeviceName } from "@/lib/deviceName";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  clearUserSecurityLock,
  updateUserRole,
  grantDocumentPermission,
  type ProfileRole,
  type AdminRole,
} from "@/app/admin/users/actions";

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  admin_role: string | null;
  is_active: boolean;
  is_locked: boolean;
  lock_reason: string | null;
  risk_score: number | null;
  created_at: string;
}
interface Order { id: string; total_amount: number; status: string; created_at: string }
interface Device { id: string; device_id: string; device_info: Record<string, unknown>; last_login: string }
interface Purchase { document_id: string; title: string; granted_at: string }
interface Note { id: string; content: string; created_at: string }

export default function AdminUserDetailClient({
  profile,
  canEditRoles = false,
  orders,
  devices,
  purchases,
  supportNotes,
}: {
  profile: Profile;
  canEditRoles?: boolean;
  orders: Order[];
  devices: Device[];
  purchases: Purchase[];
  supportNotes: Note[];
}) {
  const [newNote, setNewNote] = useState("");
  const [unlockDocId, setUnlockDocId] = useState("");
  const [role, setRole] = useState<ProfileRole>(profile.role as ProfileRole);
  const [adminRole, setAdminRole] = useState<AdminRole | "">(
    (profile.role === "admin" && profile.admin_role ? profile.admin_role : "") as AdminRole | ""
  );
  const [savingRoles, setSavingRoles] = useState(false);
  const [unlockingSecurity, setUnlockingSecurity] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const totalRevenue = orders.filter((o) => o.status === "completed").reduce((s, o) => s + o.total_amount, 0);

  async function saveRoles() {
    setSavingRoles(true);
    const result = await updateUserRole(profile.id, role, role === "admin" && adminRole ? (adminRole as AdminRole) : null);
    setSavingRoles(false);
    if (result.ok) {
      toast.success("Đã lưu phân quyền.");
      router.refresh();
    } else toast.error(result.error);
  }

  async function addNote() {
    if (!newNote.trim()) return;
    const { error } = await supabase.from("support_notes").insert({
      user_id: profile.id,
      author_id: (await supabase.auth.getUser()).data.user?.id,
      content: newNote.trim(),
    });
    if (error) toast.error(error.message);
    else {
      setNewNote("");
      toast.success("Đã thêm ghi chú");
      router.refresh();
    }
  }

  async function manualUnlock() {
    if (!unlockDocId.trim()) return;
    const result = await grantDocumentPermission(profile.id, unlockDocId.trim());
    if (result.ok) {
      setUnlockDocId("");
      toast.success("Đã cấp quyền.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function unlockSecurity() {
    setUnlockingSecurity(true);
    const result = await clearUserSecurityLock(profile.id);
    setUnlockingSecurity(false);
    if (result.ok) {
      toast.success("Đã mở khóa bảo mật.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/admin/users" className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          ← Khách hàng
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-bold text-semantic-heading">Hồ sơ khách hàng</h1>
        <p className="mt-1 font-mono text-sm text-slate-500">{profile.id}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-200 px-3 py-1 text-sm dark:bg-slate-700">{profile.full_name ?? "—"}</span>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-sm dark:bg-slate-700">{profile.role}</span>
          {profile.role === "admin" && profile.admin_role && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">{profile.admin_role}</span>
          )}
          <span className={profile.is_active ? "rounded-full bg-green-100 px-3 py-1 text-sm text-green-800 dark:bg-green-900/30" : "rounded-full bg-red-100 px-3 py-1 text-sm text-red-800 dark:bg-red-900/30"}>
            {profile.is_active ? "Hoạt động" : "Khóa"}
          </span>
          {profile.is_locked ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" title={profile.lock_reason ?? ""}>
              Khóa bảo mật (đọc PDF){profile.risk_score != null ? ` · risk ${Number(profile.risk_score).toFixed(1)}` : ""}
            </span>
          ) : null}
          <span className="text-sm text-slate-500">Đăng ký: {formatDate(profile.created_at)}</span>
        </div>
        {profile.is_locked ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-medium">Tài khoản đang bị khóa bảo mật — không đọc được tài liệu đã mua (API secure-pdf).</p>
            {profile.lock_reason ? <p className="mt-1 opacity-90">{profile.lock_reason}</p> : null}
            <button
              type="button"
              onClick={unlockSecurity}
              disabled={unlockingSecurity}
              className="mt-2 rounded-md bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-900 disabled:opacity-60 dark:bg-amber-700 dark:hover:bg-amber-600"
            >
              {unlockingSecurity ? "Đang xử lý…" : "Mở khóa bảo mật"}
            </button>
          </div>
        ) : null}
        {canEditRoles && (
          <section className="mt-6 rounded-2xl border border-line bg-surface-muted p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-semantic-heading">
              <Shield className="h-4 w-4" />
              Phân quyền
            </h2>
            <p className="mt-1 text-xs text-muted">Chỉ Super Admin mới thấy mục này. Thay đổi có hiệu lực ngay.</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs text-muted">Role</label>
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as ProfileRole);
                    if (e.target.value !== "admin") setAdminRole("");
                  }}
                  className="input-premium mt-1 w-40"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {role === "admin" && (
                <div>
                  <label className="block text-xs text-muted">Admin role</label>
                  <select
                    value={adminRole}
                    onChange={(e) => setAdminRole(e.target.value as AdminRole | "")}
                    className="input-premium mt-1 w-44"
                  >
                    <option value="">— Chọn —</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="content_manager">Content Manager</option>
                    <option value="support_agent">Support Agent</option>
                  </select>
                </div>
              )}
              <button type="button" onClick={saveRoles} disabled={savingRoles || (role === "admin" && !adminRole)} className="btn-primary">
                {savingRoles ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </section>
        )}
      </header>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-semantic-heading">
          <Unlock className="h-5 w-5" />
          Mở khóa thủ công
        </h2>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input
            type="text"
            value={unlockDocId}
            onChange={(e) => setUnlockDocId(e.target.value)}
            placeholder="Document ID (UUID)"
            className="input-premium"
          />
          <button type="button" onClick={manualUnlock} className="btn-primary">
            Cấp quyền
          </button>
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-semantic-heading">
          <BookOpen className="h-5 w-5" />
          Lịch sử mua hàng
        </h2>
        <p className="mt-1 text-sm text-slate-500">Tổng doanh thu: {totalRevenue.toLocaleString("vi-VN")} ₫</p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Đơn hàng</th>
                <th className="px-4 py-2 text-right font-medium">Số tiền</th>
                <th className="px-4 py-2 text-left font-medium">Trạng thái</th>
                <th className="px-4 py-2 text-left font-medium">Ngày</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2 font-mono text-xs">{o.id.slice(0, 8)}...</td>
                  <td className="px-4 py-2 text-right">{o.total_amount.toLocaleString("vi-VN")} ₫</td>
                  <td className="px-4 py-2">{o.status}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <p className="py-6 text-center text-slate-500">Chưa có đơn.</p>}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-semantic-heading">
          <BookOpen className="h-5 w-5" />
          Tài liệu đã mua (permissions)
        </h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Tài liệu</th>
                <th className="px-4 py-2 text-left font-medium">Mở khóa lúc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {purchases.map((p) => (
                <tr key={p.document_id}>
                  <td className="px-4 py-2">{p.title}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{formatDate(p.granted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {purchases.length === 0 && <p className="py-6 text-center text-slate-500">Chưa có.</p>}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-semantic-heading">
          <Smartphone className="h-5 w-5" />
          Thiết bị đã đăng ký
        </h2>
        <div className="mt-3 space-y-2">
          {devices.map((d) => (
            <div key={d.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="font-medium">{getFriendlyDeviceName(d.device_info)}</p>
              <p className="text-xs text-slate-500">Đăng nhập: {formatDate(d.last_login)} · {d.device_id.slice(0, 16)}...</p>
            </div>
          ))}
          {devices.length === 0 && <p className="text-slate-500">Chưa có thiết bị.</p>}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-semantic-heading">
          <MessageSquare className="h-5 w-5" />
          Ghi chú hỗ trợ
        </h2>
        <div className="mt-2 flex gap-2">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Thêm ghi chú..."
            className="input-premium min-h-[80px]"
          />
          <button type="button" onClick={addNote} className="btn-primary flex items-center gap-1">
            <Plus className="h-4 w-4" /> Thêm
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {supportNotes.map((n) => (
            <div key={n.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-sm text-slate-700 dark:text-slate-300">{n.content}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDate(n.created_at)}</p>
            </div>
          ))}
          {supportNotes.length === 0 && <p className="text-slate-500">Chưa có ghi chú.</p>}
        </div>
      </section>
    </div>
  );
}
