/**
 * Derive a friendly device name from user_agent (e.g. "iPhone 15", "MacBook Pro").
 */
export function getFriendlyDeviceName(deviceInfo: Record<string, unknown> | null): string {
  const ua = (deviceInfo?.user_agent as string) || "";
  if (!ua) return "Thiết bị";

  if (/iPhone|iPad|iPod/i.test(ua)) {
    const match = ua.match(/iPhone OS (\d+)/) || ua.match(/CPU OS (\d+)/);
    return match ? `iPhone / iPad` : "iPhone / iPad";
  }
  if (/Android/i.test(ua)) {
    if (/Mobile/i.test(ua)) return "Điện thoại Android";
    return "Máy tính bảng Android";
  }
  if (/Macintosh|Mac OS/i.test(ua)) return "MacBook / Mac";
  if (/Windows/i.test(ua)) return "PC Windows";
  if (/Linux/i.test(ua)) return "Máy tính Linux";

  return "Thiết bị";
}
