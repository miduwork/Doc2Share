"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminContext } from "@/lib/admin/guards";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { isValidUuid, normalizeUuid } from "@/lib/uuid";

export async function rollbackDocumentToVersion(input: {
  documentId: string;
  versionId: string;
}): Promise<ActionResult<{ restoredFromVersion: number }>> {
  const guard = await requireSuperAdminContext();
  if (!guard.ok) return fail(guard.error);
  const documentId = normalizeUuid(input.documentId);
  const versionId = normalizeUuid(input.versionId);
  if (!isValidUuid(documentId) || !isValidUuid(versionId)) return fail("documentId hoặc versionId không hợp lệ.");
  try {
    const serviceRole = createServiceRoleClient();
    const { data, error } = await serviceRole.rpc("rollback_document_to_version", {
      p_document_id: documentId,
      p_version_id: versionId,
      p_created_by: guard.context.userId,
    });
    if (error) return fail(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    const rolledBack = row?.rolled_back === true;
    if (!rolledBack) return fail("Rollback thất bại (version không tồn tại hoặc không thuộc tài liệu này).");
    revalidatePath("/admin/documents");
    revalidatePath(`/admin/documents/${documentId}`);
    return ok({ restoredFromVersion: row?.restored_from_version ?? 0 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Rollback thất bại.");
  }
}
