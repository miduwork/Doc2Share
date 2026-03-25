/**
 * SePay webhook payload parsing (pure). Single source of truth; synced to
 * supabase/functions/payment-webhook/providers/sepay-core.ts for Edge (Deno).
 * Run: node scripts/sync-sepay-core.mjs
 */

export type SePayPayload = {
  id?: number;
  content?: string;
  description?: string;
  transferType?: string;
  transferAmount?: number | string;
  amount?: number | string;
  referenceCode?: string;
};

export function parsePayload(rawBody: string): { ok: true; payload: SePayPayload } | { ok: false; error: string } {
  try {
    return { ok: true, payload: JSON.parse(rawBody) as SePayPayload };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}

export function normalizeOrderRef(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^VQR-/i.test(trimmed) || /^D2S-/i.test(trimmed)) return trimmed.toUpperCase();
  // Support 8-char hex prefix (from IN AN format)
  if (/^[a-fA-F0-9]{8}$/.test(trimmed)) return trimmed.toUpperCase();
  return trimmed;
}

export function extractOrderReferences(payload: SePayPayload): string[] {
  const text = `${payload.content ?? ""} ${payload.description ?? ""}`.trim();
  const refs = new Set<string>();
  const push = (v: string | null | undefined) => {
    const normalized = normalizeOrderRef(v);
    if (!normalized) return;
    refs.add(normalized);
  };

  push(payload.referenceCode);
  push(text.match(/\bVQR-[A-Za-z0-9_-]{8,80}\b/i)?.[0] ?? "");

  // Format mới: ứng dụng - người dùng - đơn (D2S-XXXX-YYYY)
  const d2sAppUserOrder = text.match(/\b(D2S-[A-Za-z0-9]{4}-[A-Za-z0-9]{8})\b/i)?.[1];
  if (d2sAppUserOrder) refs.add(d2sAppUserOrder.toUpperCase());

  // Format "IN AN XXXXXXXX" (Doc2Share current default)
  const inAn = text.match(/IN\s*AN\s*([a-fA-F0-9]{6,8})\b/i)?.[1];
  if (inAn) refs.add(inAn.toUpperCase());

  // Format cũ: D2S-XXXXXXXX (6–16 ký tự, tương thích đơn cũ)
  const d2s = text.match(/\bD2S-([A-Za-z0-9]{6,16})\b/i)?.[1];
  if (d2s) refs.add(`D2S-${d2s.toUpperCase()}`);

  const uuid = text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)?.[0];
  push(uuid);
  return Array.from(refs);
}

export function resolveEventId(payload: SePayPayload, refs: string[], payloadHash: string): string {
  if (payload.id != null) return `sepay:${String(payload.id)}`;
  const normalizedRef = normalizeOrderRef(payload.referenceCode);
  if (normalizedRef) return `sepay_ref:${normalizedRef}`;
  if (refs.length > 0) return `fallback_ref:${refs[0]}:${payloadHash.slice(0, 16)}`;
  return `fallback_hash:${payloadHash.slice(0, 24)}`;
}

export function isIncomingTransfer(payload: SePayPayload): boolean {
  return String(payload.transferType ?? "").toLowerCase() === "in";
}

export function extractAmount(payload: SePayPayload): number | null {
  const v = payload.transferAmount ?? payload.amount;
  if (v == null) return null;
  if (typeof v === "number") return Math.round(v);
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d.,]/g, "");
    if (!cleaned) return null;
    if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
      return parseInt(cleaned.replace(/\./g, ""), 10);
    }
    if (/^\d{1,3}(,\d{3})+$/.test(cleaned)) {
      return parseInt(cleaned.replace(/,/g, ""), 10);
    }
    const n = parseFloat(cleaned.replace(/,/g, "."));
    return isFinite(n) ? Math.round(n) : null;
  }
  return null;
}
