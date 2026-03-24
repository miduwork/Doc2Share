import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import type { AdminRole } from "@/lib/types";

import { createClient } from "@/lib/supabase/server";

export type CurrentUserProfile = {
  role: string;
  admin_role: AdminRole | null;
  is_active: boolean | null;
  banned_until?: string | null;
};

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export const getCurrentUserWithProfile = cache(async (): Promise<{
  user: User | null;
  profile: CurrentUserProfile | null;
}> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user ?? null;
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, admin_role, is_active, banned_until")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile: (profile as CurrentUserProfile | null) ?? null };
});

