import { notFound, redirect } from "next/navigation";
import AdminUserDetailClient from "@/components/admin/users/AdminUserDetailClient";
import { requireUserManagerContext, requireSuperAdminContext } from "@/lib/admin/guards";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

interface Props { params: Promise<{ id: string }> }

export default async function AdminUserDetailPage({ params }: Props) {
  const guard = await requireUserManagerContext();
  if (!guard.ok) redirect("/admin");

  const superAdminGuard = await requireSuperAdminContext();
  const canEditRoles = superAdminGuard.ok;

  const { id } = await params;
  const service = createServiceRoleClient();
  const { data: profileRaw, error: profileErr } = await service.from("profiles").select("*").eq("id", id).maybeSingle();
  if (profileErr || !profileRaw) notFound();
  const profile = profileRaw as {
    id: string;
    full_name: string | null;
    role: string;
    admin_role: string | null;
    is_active: boolean;
    is_locked?: boolean;
    lock_reason?: string | null;
    risk_score?: number | null;
    created_at: string;
  };

  const { data: orders } = await service.from("orders").select("id, total_amount, status, created_at").eq("user_id", id).order("created_at", { ascending: false });
  const { data: devices } = await service.from("device_logs").select("id, device_id, device_info, last_login").eq("user_id", id).order("last_login", { ascending: false });
  const { data: permissions } = await service.from("permissions").select("id, document_id, granted_at").eq("user_id", id).order("granted_at", { ascending: false });
  const docIds = (permissions ?? []).map((p) => (p as { document_id: string }).document_id);
  const docsResult = docIds.length
    ? await service.from("documents").select("id, title").in("id", docIds)
    : { data: [] };
  const docs = docsResult.data ?? [];
  const docMap = Object.fromEntries((docs as { id: string; title: string }[]).map((d) => [d.id, d.title]));
  const purchases = (permissions ?? []).map((p) => ({
    document_id: (p as { document_id: string }).document_id,
    title: docMap[(p as { document_id: string }).document_id] ?? "—",
    granted_at: (p as { granted_at: string }).granted_at,
  }));
  const { data: notes } = await service.from("support_notes").select("id, author_id, content, created_at").eq("user_id", id).order("created_at", { ascending: false });

  return (
      <div className="section-container py-6 sm:py-8">
        <AdminUserDetailClient
          profile={{
            ...profile,
            is_locked: Boolean(profile.is_locked),
            lock_reason: profile.lock_reason ?? null,
            risk_score: profile.risk_score ?? null,
          }}
          canEditRoles={canEditRoles}
          orders={(orders ?? []).map((o) => ({
            id: (o as { id: string }).id,
            total_amount: Number((o as { total_amount: number }).total_amount),
            status: (o as { status: string }).status,
            created_at: (o as { created_at: string }).created_at,
          }))}
          devices={(devices ?? []).map((d) => ({
            id: (d as { id: string }).id,
            device_id: (d as { device_id: string }).device_id,
            device_info: ((d as { device_info: unknown }).device_info as Record<string, unknown>) ?? {},
            last_login: (d as { last_login: string }).last_login,
          }))}
          purchases={purchases}
          supportNotes={(notes ?? []).map((n) => ({
            id: (n as { id: string }).id,
            content: (n as { content: string }).content,
            created_at: (n as { created_at: string }).created_at,
          }))}
        />
      </div>
  );
}
