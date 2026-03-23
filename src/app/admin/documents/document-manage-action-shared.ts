import { type AdminContext, requireDocumentManagerContext } from "@/lib/admin/guards";
import {
  createDocumentsAdminRepository,
  type DocumentsAdminRepository,
} from "@/lib/domain/documents";
import { ok, fail, type ActionResult } from "@/lib/action-result";

export type DocumentsActionDeps = {
  repository: DocumentsAdminRepository;
};

export const EDITABLE_STATUSES = new Set(["draft", "processing", "ready", "failed", "archived", "deleted"] as const);

export function sanitizeOptionalText(input: string | null | undefined, maxLen = 2000) {
  if (input == null) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

export async function getDocumentAdminContext(): Promise<ActionResult<AdminContext>> {
  const guard = await requireDocumentManagerContext();
  if (!guard.ok) return fail(guard.error);
  return ok(guard.context);
}

export async function getDocumentAdminContextOrProvided(context?: AdminContext): Promise<ActionResult<AdminContext>> {
  if (context) return ok(context);
  return getDocumentAdminContext();
}

export function resolveDocumentsDeps(overrides?: Partial<DocumentsActionDeps>): DocumentsActionDeps {
  return {
    repository: overrides?.repository ?? createDocumentsAdminRepository(),
  };
}
