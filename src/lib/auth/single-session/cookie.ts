import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/constants";

export async function getSessionCookieId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export async function setSessionCookieId(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  } as const);
}

export async function clearSessionCookieId(response?: NextResponse): Promise<void> {
  const cookieOptions = {
    httpOnly: true,
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  } as const;

  if (response) {
    response.cookies.set(SESSION_COOKIE, "", cookieOptions);
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", cookieOptions);
}

