import { createClient } from "@/lib/supabase/server";
import AdminCouponsClient from "@/components/admin/AdminCouponsClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { redirect } from "next/navigation";
import { requireSuperAdminContext } from "@/lib/admin/guards";

export default async function AdminCouponsPage() {
  const guard = await requireSuperAdminContext();
  if (!guard.ok) redirect("/admin");

  const supabase = await createClient();
  const { data: coupons } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });

  return (
    <div>
      <AdminPageHeader
        title="Mã giảm giá"
        description="Tạo mã theo chiến dịch (vd: ONTHI2026) cho nhóm đối tượng hoặc bộ tài liệu"
      />
      <AdminCouponsClient initialCoupons={coupons ?? []} />
    </div>
  );
}
