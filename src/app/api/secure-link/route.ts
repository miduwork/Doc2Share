/**
 * API route: trả signed URL để đọc tài liệu (JSON { url }).
 * Cookie session; cùng quy tắc với /api/secure-pdf (secure-access-core) và cùng rate limit / audit (action secure_pdf).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SECURE_ACCESS_DEFAULTS } from "@/lib/secure-access/secure-access-core";
import { runNextSecureDocumentAccess } from "@/lib/secure-access/run-next-secure-document-access";

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const supabase = await createClient();
    const access = await runNextSecureDocumentAccess({
      req,
      supabase,
      requestId,
      startedAt,
    });
    if (!access.ok) return access.response;

    const { data: signedData, error: signError } = await access.ctx.service.storage
      .from("private_documents")
      .createSignedUrl(access.ctx.filePath, SECURE_ACCESS_DEFAULTS.SIGNED_URL_EXPIRY_SECONDS);

    if (signError || !signedData?.signedUrl) {
      console.error("secure-link: signed URL error", signError);
      return NextResponse.json({ error: "Không thể tạo link xem tài liệu." }, { status: 500 });
    }

    await access.ctx.logSuccess();

    return NextResponse.json({ url: signedData.signedUrl });
  } catch (err) {
    console.error("secure-link:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
