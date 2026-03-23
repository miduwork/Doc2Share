import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const SESSION_COOKIE = "doc2share_sid";

/**
 * Kiểm tra single session: nếu user có cookie doc2share_sid thì phải khớp với active_sessions.
 * Nếu không khớp (đã đăng nhập từ thiết bị khác) trả về false.
 */
export async function isCurrentSessionValid(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return true; // Không có cookie = phiên cũ, vẫn cho qua

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: row } = await supabase
    .from("active_sessions")
    .select("session_id")
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .maybeSingle();

  return row != null;
}
