import { createClient } from "@/lib/supabase/client";

/**
 * Client-side sign-out to clear local Supabase auth state.
 * Kept in a shared util so UI hooks can reuse it.
 */
export async function signOutClientSession(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

