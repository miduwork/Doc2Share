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

    // P0: Zero-vector enforcement conditional on isHighValue.
    // Respect documents.is_high_value flag from database.
    if (access.ctx.isHighValue) {
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
    }

    // Normal PDF path for non-high-value documents.
    const { data: fileData, error: fileError } = await access.ctx.service.storage
      .from("private_documents")
      .download(access.ctx.filePath);

    if (fileError || !fileData) {
      console.error("secure-pdf: storage download", fileError?.message);
      return NextResponse.json(
        { error: "Không thể tải file PDF từ hệ thống lưu trữ.", code: "storage_error" },
        { status: 503 }
      );
    }

    return new Response(fileData, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "X-D2S-Request-ID": requestId,
        "X-D2S-Is-High-Value": "false",
        "X-D2S-Num-Pages": String(access.ctx.numPages),
        "X-D2S-Is-Downloadable": access.ctx.isDownloadable ? "true" : "false",
        "X-D2S-WM-Short": access.ctx.watermark.wmShort,
        "X-D2S-WM-Doc-Short": access.ctx.watermark.wmDocShort,
        "X-D2S-WM-Issued-At-Bucket": access.ctx.watermark.wmIssuedAtBucket,
        "X-D2S-WM-Version": access.ctx.watermark.wmVersion
      }
    });
  } catch (err) {
    console.error("secure-pdf:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
