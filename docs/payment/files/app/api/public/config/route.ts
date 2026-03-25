import { NextResponse } from "next/server";
import { getPublicAppConfig } from "@/lib/orders/appConfig.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Giá/cấu hình — không cache CDN/trình duyệt để khớp admin ngay sau khi lưu. */
const CACHE_CONTROL = "private, no-store";

export async function GET() {
  try {
    const data = await getPublicAppConfig();
    return NextResponse.json(data, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  } catch (e) {
    console.error("GET /api/public/config:", e);
    return NextResponse.json(
      { error: "Không tải được cấu hình." },
      { status: 500 },
    );
  }
}
