import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/auth/requireAdminApi";
import {
  getAppConfigForAdmin,
  updateAppConfig,
} from "@/lib/orders/appConfig.server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const gate = await requireAdminApiSession(supabase);
    if (!gate.ok) return gate.response;

    const result = await getAppConfigForAdmin();
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }
    return NextResponse.json({
      config: result.config,
      updatedAt: result.updatedAt,
    });
  } catch (e) {
    console.error("GET /api/admin/settings:", e);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tải cấu hình." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const gate = await requireAdminApiSession(supabase);
    if (!gate.ok) return gate.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || !("config" in body)) {
      return NextResponse.json(
        { error: "Thiếu trường config (AppConfigV1)." },
        { status: 400 },
      );
    }

    const result = await updateAppConfig(
      (body as { config: unknown }).config,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    return NextResponse.json({
      config: result.config,
      updatedAt: result.updatedAt,
    });
  } catch (e) {
    console.error("PATCH /api/admin/settings:", e);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lưu cấu hình." },
      { status: 500 },
    );
  }
}
