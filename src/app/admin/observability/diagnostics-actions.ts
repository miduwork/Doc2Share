"use server";

import { headers } from "next/headers";
import { requireSuperAdminContext } from "@/lib/admin/guards";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { buildObservabilitySignedPayload, createObservabilityShareSignature } from "@/lib/admin/observability-diagnostics.service";
import type { SignedLinkInput } from "./action-shared";

export async function createSignedDiagnosticsLink(input: SignedLinkInput): Promise<ActionResult<{ message: string; link: string }>> {
  try {
    const adminCheck = await requireSuperAdminContext();
    if (!adminCheck.ok) return fail(adminCheck.error);

    const secret = process.env.DIAGNOSTICS_SHARE_SECRET;
    if (!secret) return fail("Thiếu DIAGNOSTICS_SHARE_SECRET trên server.");

    const shareExp = String(Math.floor(Date.now() / 1000) + 2 * 60 * 60);
    const payload = buildObservabilitySignedPayload({
      input: {
        ...input,
        share_exp: shareExp,
      },
    });
    const signature = createObservabilityShareSignature({ payload, secret });

    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : "");
    if (!baseUrl) return fail("Không xác định được base URL để tạo link.");

    const qs = new URLSearchParams({
      ...payload,
      share_sig: signature,
    });
    const hash = payload.preset === "custom" ? "" : "#alerts-panel";
    const link = `${baseUrl}/admin/observability?${qs.toString()}${hash}`;
    return ok({ message: "Đã tạo signed link.", link });
  } catch (error) {
    console.error("createSignedDiagnosticsLink failed:", error);
    return fail("Không thể tạo signed diagnostics link.");
  }
}
