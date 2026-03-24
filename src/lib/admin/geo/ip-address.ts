export function isPrivateOrUnknownIp(ip: string): boolean {
  const value = (ip || "").trim().toLowerCase();
  if (!value || value === "unknown" || value === "::1" || value === "127.0.0.1") return true;
  if (value.startsWith("10.") || value.startsWith("192.168.") || value.startsWith("172.")) return true;
  return false;
}
