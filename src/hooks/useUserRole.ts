"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRole } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export interface UseUserRoleResult {
  user: User | null;
  role: ProfileRole | null;
  isAdmin: boolean;
  loading: boolean;
}

/**
 * React hook for RBAC: provides current user, profile role, and isAdmin.
 * Use in layout/nav to show Admin link only when userRole === 'admin'.
 */
export function useUserRole(): UseUserRoleResult {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
      if (!u?.id) {
        setRole(null);
        setLoading(false);
        return;
      }
      supabase
        .from("profiles")
        .select("role")
        .eq("id", u.id)
        .single()
        .then(
          ({ data }) => {
            setRole((data?.role as ProfileRole) ?? null);
            setLoading(false);
          },
          () => setLoading(false)
        );
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (!u?.id) {
        setRole(null);
        return;
      }
      supabase
        .from("profiles")
        .select("role")
        .eq("id", u.id)
        .single()
        .then(({ data }) => setRole((data?.role as ProfileRole) ?? null));
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase from createClient() stable per mount; run once
  }, []);

  return {
    user,
    role,
    isAdmin: role === "admin",
    loading,
  };
}
