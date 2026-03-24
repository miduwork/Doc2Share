import { createClient } from "@/lib/supabase/server";
import AdminCategoriesClient from "@/components/admin/AdminCategoriesClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { redirect } from "next/navigation";
import { requireDocumentManagerContext } from "@/lib/admin/guards";

export default async function AdminCategoriesPage() {
  const guard = await requireDocumentManagerContext();
  if (!guard.ok) redirect("/admin");

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, type, created_at")
    .order("type")
    .order("name");

  return (
    <div>
      <AdminPageHeader
        title="Danh mục"
        description="Quản lý theo từng phần Môn học, Khối lớp, Kỳ thi — dùng cho dropdown đăng tài liệu và bộ lọc"
      />
      <AdminCategoriesClient initialCategories={categories ?? []} />
    </div>
  );
}
