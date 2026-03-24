export type QuickPreviewVariant = "A" | "B";

type ResolveQuickPreviewVariantArgs = {
  qpVariantParam?: string | null;
  cookieVariant?: string | null;
};

function normalizeVariant(value?: string | null): QuickPreviewVariant | null {
  if (value === "A" || value === "B") return value;
  return null;
}

export function resolveQuickPreviewVariant({
  qpVariantParam,
  cookieVariant,
}: ResolveQuickPreviewVariantArgs): QuickPreviewVariant {
  const fromQuery = normalizeVariant(qpVariantParam);
  if (fromQuery) return fromQuery;

  const fromCookie = normalizeVariant(cookieVariant);
  if (fromCookie) return fromCookie;

  return "A";
}
