import type { SupabaseClient } from "@supabase/supabase-js";
import { clampInt } from "../search-params.ts";
import { getSinceIso } from "@/features/admin/observability/shared/formatters";
import { DEFAULT_OBSERVABILITY_FILTERS } from "@/features/admin/observability/filters/model/filters.types";
import {
  buildObservabilitySignedPayload,
  isObservabilityShareSignatureValid,
} from "./observability-diagnostics.service.ts";

export type ObservabilityExportRequest = {
  payload: ReturnType<typeof buildObservabilitySignedPayload>;
  shareSig: string;
  limit: number;
  sinceIso: string | null;
};

export function parseObservabilityExportRequest(reqUrl: string): ObservabilityExportRequest {
  const url = new URL(reqUrl);
  const limit = clampInt(url.searchParams.get("limit") ?? DEFAULT_OBSERVABILITY_FILTERS.exportLimit, 100, 10000, 2000);
  const payload = buildObservabilitySignedPayload({
    input: {
      preset: url.searchParams.get("preset") ?? undefined,
      window: url.searchParams.get("window") ?? undefined,
      severity: url.searchParams.get("severity") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
      event_type: url.searchParams.get("event_type") ?? undefined,
      alerts_cursor: url.searchParams.get("alerts_cursor") ?? undefined,
      alerts_dir: url.searchParams.get("alerts_dir") ?? undefined,
      alerts_page: url.searchParams.get("alerts_page") ?? undefined,
      runs_page: url.searchParams.get("runs_page") ?? undefined,
      alerts_page_size: url.searchParams.get("alerts_page_size") ?? undefined,
      runs_page_size: url.searchParams.get("runs_page_size") ?? undefined,
      export_limit: url.searchParams.get("export_limit") ?? undefined,
      share_exp: url.searchParams.get("share_exp") ?? undefined,
    },
    fallbackExportLimit: String(limit),
  });
  return {
    payload,
    shareSig: url.searchParams.get("share_sig") ?? "",
    limit,
    sinceIso: getSinceIso(payload.window),
  };
}

export async function authorizeObservabilityExportAccess({
  supabase,
  payload,
  shareSig,
}: {
  supabase: SupabaseClient;
  payload: ReturnType<typeof buildObservabilitySignedPayload>;
  shareSig: string;
}): Promise<Response | null> {
  const hasValidShareSignature = isObservabilityShareSignatureValid({ payload, shareSig });
  if (hasValidShareSignature) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, admin_role, is_active")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin" || profile.admin_role !== "super_admin" || !profile.is_active) {
    return new Response("Forbidden", { status: 403 });
  }
  return null;
}

export function csvEscape(value: string | number): string {
  const raw = String(value ?? "");
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function buildCsvResponse({ csv, filename }: { csv: string; filename: string }): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
