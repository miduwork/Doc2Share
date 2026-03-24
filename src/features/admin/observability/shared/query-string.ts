export function toQueryString(params: Record<string, string>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    q.set(key, value);
  }
  return q.toString();
}
