/**
 * API route: tải PDF từ storage (server-side) và stream về client.
 * Có rate limiting và audit log (access_logs).
 * Quy tắc nghiệp vụ dùng chung: @/lib/secure-access/secure-access-core
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

    // P1: dù trả 403 để ép về image-mode, vẫn tính đây là một "success view" cho audit/rate-limit semantics.
    await access.ctx.logSuccess();

    // P0: Zero-vector enforcement for ALL documents.
    // Always route client to SSW (image mode) so we never return vector PDF.
    return NextResponse.json(
      {
        error: "Tài liệu này yêu cầu chế độ bảo vệ nâng cao (SSW).",
        is_high_value: true,
        num_pages: access.ctx.numPages,
        is_downloadable: access.ctx.isDownloadable
      },
      {
        status: 403,
        headers: {
          "X-D2S-Request-ID": requestId,
          "X-D2S-Is-High-Value": "true",
          "X-D2S-Num-Pages": String(access.ctx.numPages),
          "X-D2S-Is-Downloadable": access.ctx.isDownloadable ? "true" : "false",
          "X-D2S-WM-Short": access.ctx.watermark.wmShort,
          "X-D2S-WM-Doc-Short": access.ctx.watermark.wmDocShort,
          "X-D2S-WM-Issued-At-Bucket": access.ctx.watermark.wmIssuedAtBucket,
          "X-D2S-WM-Version": access.ctx.watermark.wmVersion
        }
      }
    );
  } catch (err) {
    console.error("secure-pdf:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
