import "server-only";

import type { DocumentPipelineRepository, DocumentPipelineTickResult } from "@/lib/domain/document-pipeline/ports";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type PipelineRow = { claimed?: number; completed?: number; failed?: number } | null;

export function createSupabaseDocumentPipelineRepository(): DocumentPipelineRepository {
  const serviceRole = createServiceRoleClient();

  return {
    async runTick(limit: number): Promise<DocumentPipelineTickResult> {
      const { data, error } = await serviceRole.rpc("run_document_pipeline_tick", {
        p_limit: limit,
      });
      if (error) throw new Error(error.message);
      const row = (Array.isArray(data) ? data[0] : data) as PipelineRow;

      return {
        claimed: Number(row?.claimed ?? 0),
        completed: Number(row?.completed ?? 0),
        failed: Number(row?.failed ?? 0),
      };
    },
  };
}
