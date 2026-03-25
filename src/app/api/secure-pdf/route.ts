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

    // Phase 3: Zero-Vector Hardening
    // Nếu là tài liệu nhạy cảm cao, chặn hoàn toàn việc tải PDF vector.
    // Trả về headers để client biết cần chuyển sang chế độ SSW (Image Mode).
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
            "X-D2S-Is-High-Value": "true",
            "X-D2S-Num-Pages": String(access.ctx.numPages),
            "X-D2S-Is-Downloadable": access.ctx.isDownloadable ? "true" : "false",
          }
        }
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "X-D2S-WM-Short": access.ctx.watermark.wmShort,
      "X-D2S-WM-Doc-Short": access.ctx.watermark.wmDocShort,
      "X-D2S-WM-Issued-At-Bucket": access.ctx.watermark.wmIssuedAtBucket,
      "X-D2S-WM-Version": access.ctx.watermark.wmVersion,
      "X-D2S-Is-Downloadable": access.ctx.isDownloadable ? "true" : "false",
    };

    // Ưu tiên stream để giảm peak RAM và có thể cải thiện TTFB với PDF lớn.
    const { data: stream, error: streamError } = await access.ctx.service.storage
      .from("private_documents")
      .download(access.ctx.filePath)
      .asStream();

    if (!streamError && stream) {
      await access.ctx.logSuccess();
      return new NextResponse(stream as unknown as ReadableStream, {
        status: 200,
        headers,
      });
    }

    if (streamError) {
      console.error("secure-pdf: stream download error", streamError);
    }

    // Fallback (ít rủi ro): quay lại cách cũ nếu stream không khả dụng.
    const { data: blob, error: downloadError } = await access.ctx.service.storage
      .from("private_documents")
      .download(access.ctx.filePath);

    if (downloadError || !blob) {
      console.error("secure-pdf: download error", downloadError);
      return NextResponse.json({ error: "Không thể tải tài liệu." }, { status: 500 });
    }

    await access.ctx.logSuccess();

    const buffer = await blob.arrayBuffer();
    const finalHeaders = { ...headers };
    if (typeof (blob as any)?.size === "number") {
      finalHeaders["Content-Length"] = String((blob as any).size);
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: finalHeaders,
    });
  } catch (err) {
    console.error("secure-pdf:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
