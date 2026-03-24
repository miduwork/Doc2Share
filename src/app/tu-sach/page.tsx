import { redirect } from "next/navigation";
import PublicLayout from "@/features/layout/components/PublicLayout";
import { createClient } from "@/lib/supabase/server";
import { isCurrentSessionValid } from "@/lib/session";
import { getSessionCookieId } from "@/lib/auth/single-session";
import DashboardClient from "@/features/dashboard/components/DashboardClient";

export default async function TuSachPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/tu-sach");
  if (!(await isCurrentSessionValid())) redirect("/login?redirect=/tu-sach&reason=session_replaced");

  const hasSessionCookie = !!(await getSessionCookieId());

  const now = new Date().toISOString();
  const { data: permissionsRaw } = await supabase
    .from("permissions")
    .select(`
      id, document_id, granted_at, expires_at,
      document:documents(id, title, preview_url, thumbnail_url, price, grade_id, subject_id, exam_id)
    `)
    .eq("user_id", user.id)
    .order("granted_at", { ascending: false });

  const permissions = (permissionsRaw ?? []).filter(
    (p) => (p as { expires_at: string | null }).expires_at == null || (p as { expires_at: string }).expires_at > now
  );

  const { data: devices } = await supabase
    .from("device_logs")
    .select("id, device_id, device_info, last_login")
    .eq("user_id", user.id)
    .order("last_login", { ascending: false });

  const { data: categoriesRaw } = await supabase
    .from("categories")
    .select("id, name, type")
    .order("type")
    .order("name");

  const categories = categoriesRaw ?? [];
  const grades = categories.filter((c) => c.type === "grade");
  const subjects = categories.filter((c) => c.type === "subject");
  const exams = categories.filter((c) => c.type === "exam");

  const docs = (permissions ?? []).map((p) => {
    const d = (p as { document?: unknown }).document;
    const doc = Array.isArray(d) ? d[0] : d;
    return {
      id: (p as { document_id: string }).document_id,
      title: (doc as { title?: string })?.title ?? "",
      preview_url: (doc as { preview_url?: string })?.preview_url ?? null,
      thumbnail_url: (doc as { thumbnail_url?: string })?.thumbnail_url ?? null,
      granted_at: (p as { granted_at: string }).granted_at,
      grade_id: (doc as { grade_id?: string | number | null })?.grade_id == null ? null : String((doc as { grade_id?: string | number }).grade_id),
      subject_id: (doc as { subject_id?: string | number | null })?.subject_id == null ? null : String((doc as { subject_id?: string | number }).subject_id),
      exam_id: (doc as { exam_id?: string | number | null })?.exam_id == null ? null : String((doc as { exam_id?: string | number }).exam_id),
    };
  });

  return (
    <PublicLayout>
      <div className="section-container py-8">
        <DashboardClient
          hasSessionCookie={hasSessionCookie}
          library={docs}
          grades={grades}
          subjects={subjects}
          exams={exams}
          devices={(devices ?? []).map((d) => ({
            id: d.id,
            device_id: d.device_id,
            device_info: (d.device_info as Record<string, unknown>) ?? {},
            last_login: d.last_login,
          }))}
        />
      </div>
    </PublicLayout>
  );
}

