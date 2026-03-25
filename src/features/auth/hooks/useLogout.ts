"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { logoutAndCleanupSession } from "@/lib/auth/single-session/logoutAndCleanupSession";
import { signOutClientSession } from "@/lib/auth/client-signout";

type LogoutOptions = {
  redirectTo?: string;
  refresh?: boolean;
};

export function useLogout() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const triggerLogout = useCallback(async (options: LogoutOptions = {}) => {
    const { redirectTo, refresh = false } = options;
    setLoading(true);
    try {
      const [serverResult] = await Promise.allSettled([
        logoutAndCleanupSession(),
        signOutClientSession(),
      ]);

      // Even if server cleanup fails, client sign-out already clears local auth state.
      if (
        serverResult.status === "fulfilled" &&
        !serverResult.value.ok
      ) {
        console.warn("logout cleanup failed:", serverResult.value.error);
      }

      // Full navigation (not client router only): avoids leaving a protected route's
      // RSC-rendered body visible after auth clears (header updates from Supabase listener first).
      if (redirectTo) {
        window.location.replace(redirectTo);
        return;
      }
      if (refresh) router.refresh();
    } finally {
      setLoading(false);
    }
  }, [router]);

  return { triggerLogout, loading };
}

