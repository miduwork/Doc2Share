import { redirect } from "next/navigation";
import { requireDocumentManagerContext } from "@/lib/admin/guards";

export default async function AdminBulkHistoryPage() {
  const guard = await requireDocumentManagerContext();
  if (!guard.ok) redirect("/admin");
  redirect("/admin/documents?workspace=bulk-history");
}

