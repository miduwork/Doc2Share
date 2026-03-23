import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/admin/AdminNav";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, admin_role, is_active")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" || !profile?.is_active) redirect("/dashboard");

  return (
    <div className="app-shell flex min-h-screen">
      <aside className="admin-sidebar hidden w-52 shrink-0 border-r border-line bg-slate-50/90 dark:bg-slate-950/90 lg:block">
        <div className="sticky top-0 flex h-screen flex-col py-3">
          <Link href="/admin" className="admin-brand mx-2 mb-1.5 flex items-center gap-2 rounded-lg px-2.5 py-2 transition hover:bg-slate-200/60 dark:hover:bg-slate-800/60">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white">
              <span className="text-xs font-bold">D2S</span>
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-semantic-heading">Admin</span>
              <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">Doc2Share</span>
            </div>
          </Link>
          <div className="flex-1 overflow-y-auto px-1.5">
            <AdminNav adminRole={profile?.admin_role ?? "support_agent"} />
          </div>
        </div>
      </aside>
      <main id="main-content" tabIndex={-1} className="admin-main flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950/50">
        <div className="admin-mobile-nav border-b border-line bg-white/90 px-3 py-2 backdrop-blur dark:bg-slate-950/90 lg:hidden">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Menu</p>
          <AdminNav adminRole={profile?.admin_role ?? "support_agent"} mode="inline" />
        </div>
        <div className="admin-content mx-auto min-h-full max-w-6xl px-3 py-4 sm:px-5 lg:px-6">
          <AdminBreadcrumb />
          {children}
        </div>
      </main>
    </div>
  );
}
