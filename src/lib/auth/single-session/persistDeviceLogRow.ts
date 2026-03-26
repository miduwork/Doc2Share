import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

/**
 * Ghi device_logs mà không dùng PostgREST upsert + onConflict.
 * Một số DB production thiếu UNIQUE (user_id, device_id) khớp với onConflict → upsert lỗi
 * ("there is no unique or exclusion constraint matching the ON CONFLICT specification").
 */
export type PersistDeviceLogInput = {
  user_id: string;
  device_id: string;
  device_info: Record<string, unknown>;
  hardware_fingerprint?: unknown | null;
  hardware_hash?: string | null;
  last_login: string;
};

/** DB chưa chạy migration hardware → PostgREST/Postgres báo thiếu cột. */
export function isLikelyMissingHardwareColumnError(e: PostgrestError): boolean {
  if (e.code === "42703" || e.code === "PGRST204") return true;
  const t = `${e.message} ${e.details ?? ""} ${e.hint ?? ""}`.toLowerCase();
  const mentionsHw = t.includes("hardware_fingerprint") || t.includes("hardware_hash");
  const mentionsMissing =
    t.includes("does not exist") ||
    t.includes("could not find") ||
    t.includes("unknown column") ||
    t.includes("schema cache");
  return mentionsHw && mentionsMissing;
}

export async function persistDeviceLogRow(
  supabase: SupabaseClient,
  row: PersistDeviceLogInput
): Promise<{ error: PostgrestError | null }> {
  const { data: existing, error: selectErr } = await supabase
    .from("device_logs")
    .select("id")
    .eq("user_id", row.user_id)
    .eq("device_id", row.device_id)
    .maybeSingle();

  if (selectErr) {
    return { error: selectErr };
  }

  const payloadWithHw = {
    device_info: row.device_info,
    hardware_fingerprint: row.hardware_fingerprint ?? null,
    hardware_hash: row.hardware_hash ?? null,
    last_login: row.last_login,
  };
  const payloadNoHw = {
    device_info: row.device_info,
    last_login: row.last_login,
  };

  if (existing?.id) {
    let { error } = await supabase.from("device_logs").update(payloadWithHw).eq("id", existing.id);
    if (error && isLikelyMissingHardwareColumnError(error)) {
      ({ error } = await supabase.from("device_logs").update(payloadNoHw).eq("id", existing.id));
    }
    return { error };
  }

  let { error } = await supabase.from("device_logs").insert({
    user_id: row.user_id,
    device_id: row.device_id,
    ...payloadWithHw,
  });
  if (error && isLikelyMissingHardwareColumnError(error)) {
    ({ error } = await supabase.from("device_logs").insert({
      user_id: row.user_id,
      device_id: row.device_id,
      ...payloadNoHw,
    }));
  }
  return { error };
}
