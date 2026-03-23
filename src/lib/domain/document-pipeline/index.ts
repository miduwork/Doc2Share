import "server-only";

import { createSupabaseDocumentPipelineRepository } from "@/lib/domain/document-pipeline/adapters/supabase";
import type { DocumentPipelineRepository } from "@/lib/domain/document-pipeline/ports";

export type { DocumentPipelineRepository, DocumentPipelineTickResult } from "@/lib/domain/document-pipeline/ports";
export { createSupabaseDocumentPipelineRepository } from "@/lib/domain/document-pipeline/adapters/supabase";

export function createDocumentPipelineRepository(): DocumentPipelineRepository {
  return createSupabaseDocumentPipelineRepository();
}
