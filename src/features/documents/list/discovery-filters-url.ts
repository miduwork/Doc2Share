/**
 * URL logic shared by DiscoveryFilters (mobile selects + desktop sidebar pills).
 * Mobile can clear one dimension via "Tất cả"; desktop uses Reset for a full clear.
 * Both UIs call the same update path — no duplicated query rules.
 */
export function applyDiscoveryFilterUpdate(
  current: string | URLSearchParams,
  key: string,
  value: string | null
): { search: string } {
  const raw =
    typeof current === "string"
      ? current.replace(/^\?/, "")
      : current.toString();
  const next = new URLSearchParams(raw);

  if (value) next.set(key, value);
  else next.delete(key);
  next.delete("page");

  return { search: next.toString() };
}
