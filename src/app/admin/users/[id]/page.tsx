import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminUserDetailClient from "@/components/admin/users/AdminUserDetailClient";
import { requireUserManagerContext, requireSuperAdminContext } from "@/lib/admin/guards";

interface Props { params: Promise<{ id: string }> }

export default async function AdminUserDetailPage({ params }: Props) {
  const guard = await requireUserManagerContext();
  if (!guard.ok) redirect("/admin");

  const superAdminGuard = await requireSuperAdminContext();
  const canEditRoles = superAdminGuard.ok;

  const { id } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role, admin_role, is_active, created_at").eq("id", id).single();
  if (!profile) notFound();

  const { data: orders } = await supabase.from("orders").select("id, total_amount, status, created_at").eq("user_id", id).order("created_at", { ascending: false });
  const { data: devices } = await supabase.from("device_logs").select("id, device_id, device_info, last_login").eq("user_id", id).order("last_login", { ascending: false });
  const { data: permissions } = await supabase.from("permissions").select("id, document_id, granted_at").eq("user_id", id).order("granted_at", { ascending: false });
  const docIds = (permissions ?? []).map((p) => (p as { document_id: string }).document_id);
  const docsResult = docIds.length
    ? await supabase.from("documents").select("id, title").in("id", docIds)
    : { data: [] };
  const docs = docsResult.data ?? [];
  const docMap = Object.fromEntries((docs as { id: string; title: string }[]).map((d) => [d.id, d.title]));
  const purchases = (permissions ?? []).map((p) => ({
    document_id: (p as { document_id: string }).document_id,
    title: docMap[(p as { document_id: string }).document_id] ?? "—",
    granted_at: (p as { granted_at: string }).granted_at,
  }));
  const { data: notes } = await supabase.from("support_notes").select("id, author_id, content, created_at").eq("user_id", id).order("created_at", { ascending: false });

  return (
      <div className="section-container py-6 sm:py-8">
        <AdminUserDetailClient
          profile={profile}
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
