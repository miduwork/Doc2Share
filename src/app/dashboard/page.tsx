import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import { isCurrentSessionValid } from "@/lib/session";
import DashboardClient from "./DashboardClient";

const SESSION_COOKIE = "doc2share_sid";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard");
  if (!(await isCurrentSessionValid())) redirect("/login?redirect=/dashboard&reason=session_replaced");
  const cookieStore = await cookies();
  const hasSessionCookie = !!cookieStore.get(SESSION_COOKIE)?.value;

  const now = new Date().toISOString();
  const { data: permissionsRaw } = await supabase
    .from("permissions")
    .select(`
      id, document_id, granted_at, expires_at,
      document:documents(id, title, preview_url, thumbnail_url, price)
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

  const docs = (permissions ?? []).map((p) => {
    const d = (p as { document?: unknown }).document;
    const doc = Array.isArray(d) ? d[0] : d;
    return {
      id: (p as { document_id: string }).document_id,
      title: (doc as { title?: string })?.title ?? "",
      preview_url: (doc as { preview_url?: string })?.preview_url ?? null,
      thumbnail_url: (doc as { thumbnail_url?: string })?.thumbnail_url ?? null,
      granted_at: (p as { granted_at: string }).granted_at,
    };
  });

  return (
    <div className="app-shell flex flex-col">
      <Header />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <DashboardClient
          hasSessionCookie={hasSessionCookie}
          library={docs}
          devices={(devices ?? []).map((d) => ({
            id: d.id,
            device_id: d.device_id,
            device_info: (d.device_info as Record<string, unknown>) ?? {},
            last_login: d.last_login,
          }))}
        />
      </main>
      <footer className="border-t border-line py-4 text-center text-sm text-slate-500">
        © Doc2Share
      </footer>
    </div>
  );
}
