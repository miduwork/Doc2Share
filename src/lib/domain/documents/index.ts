import "server-only";

import { createSupabaseDocumentsAdminRepository } from "@/lib/domain/documents/adapters/supabase";
import type { DocumentsAdminRepository } from "@/lib/domain/documents/ports";

export type {
  DocumentPublishGate,
  DocumentRetryContext,
  UpdateDocumentAdminInput,
  DocumentsAdminRepository,
} from "@/lib/domain/documents/ports";
export { createSupabaseDocumentsAdminRepository } from "@/lib/domain/documents/adapters/supabase";

export function createDocumentsAdminRepository(): DocumentsAdminRepository {
  return createSupabaseDocumentsAdminRepository();
}
