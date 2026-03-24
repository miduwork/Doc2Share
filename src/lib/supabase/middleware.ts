import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/constants";
import { revokeAndClearSingleSession } from "@/lib/auth/single-session/logoutCore";

function isRefreshTokenInvalid(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === "refresh_token_not_found" || code === "invalid_refresh_token";
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    if (isRefreshTokenInvalid(err)) {
      // Revoke single-session record (prefer session_id cookie), then clear cookie.
      const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
      await revokeAndClearSingleSession({ sessionId, userId: user?.id, response });
      await supabase.auth.signOut();
    }
  }

  // Layer 1 RBAC: protect /admin/* — prefer JWT app_metadata for speed,
  // then safely fallback to profiles when claims are missing/stale.
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Optimization Phase 3: Using Custom Claims (app_metadata) instead of DB query
    const appMetadata = (user as any).app_metadata || {};
    let role: string | null = appMetadata.role ?? null;
    let isActive: boolean = appMetadata.is_active ?? true; // Defaults to true if not set
    let bannedUntil: string | null = appMetadata.banned_until ?? null;

    // Fallback when claims are not yet synced to auth.users/app_metadata.
    if (!role) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_active, banned_until")
        .eq("id", user.id)
        .maybeSingle();
      role = profile?.role ?? null;
      isActive = profile?.is_active ?? false;
      bannedUntil = profile?.banned_until ?? null;
    }

    if (role !== "admin") {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    const isBanned = Boolean(bannedUntil && new Date(bannedUntil) > new Date());
    if (!isActive || isBanned) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  return response;
}
