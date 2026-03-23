import { vi, type Messages } from "./messages/vi";

const messages: Record<string, Messages> = { vi };

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const value = path.split(".").reduce(
    (acc: unknown, part) =>
      acc != null && typeof acc === "object" && part in (acc as object)
        ? (acc as Record<string, unknown>)[part]
        : undefined,
    obj as unknown
  );
  return typeof value === "string" ? value : undefined;
}

/**
 * Lấy chuỗi theo key (vd. "auth.login.title").
 * Bước đầu: locale cố định "vi"; sau có thể mở rộng theo locale/namespace.
 */
export function t(key: string, locale: string = "vi"): string {
  const dict = messages[locale] ?? messages.vi;
  return getNested(dict as unknown as Record<string, unknown>, key) ?? key;
}

export { vi };
export type { Messages };
