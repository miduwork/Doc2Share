import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runNextSecureDocumentAccess } from "@/lib/secure-access/run-next-secure-document-access";
import { rasterizePdfPage } from "@/lib/secure-access/ssw/rasterizer";

// Global cache to prevent downloading the entire PDF for each individual page
const pdfBufferCache = new Map<string, { buffer: Buffer; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 10;

export async function POST(req: Request) {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();

    try {
        // Parse body ONCE up front — req.json() consumes the ReadableStream and cannot be read twice.
        const body = await req.json().catch(() => ({}));
        const page = parseInt(body.page || "1", 10);

        // Reconstruct a fresh Request so runNextSecureDocumentAccess can read the body independently.
        const accessReq = new Request(req.url, {
            method: req.method,
            headers: req.headers,
            body: JSON.stringify(body),
        });

        const supabase = await createClient();

        // 1. Run security checks
        const access = await runNextSecureDocumentAccess({
            req: accessReq,
            supabase,
            requestId,
            startedAt,
        });
        if (!access.ok) return access.response;

        // 2. Fetch PDF buffer from storage (with in-memory LRU caching to prevent per-page downloads)
        const cacheKey = access.ctx.documentId;
        const now = Date.now();
        let pdfBuffer: Buffer;

        const cached = pdfBufferCache.get(cacheKey);
        if (cached && (now - cached.cachedAt < CACHE_TTL_MS)) {
            pdfBuffer = cached.buffer;
            // Refresh LRU
            pdfBufferCache.delete(cacheKey);
            pdfBufferCache.set(cacheKey, cached);
        } else {
            const { data: buffer, error: downloadError } = await access.ctx.service.storage
                .from("private_documents")
                .download(access.ctx.filePath);

            if (downloadError || !buffer) {
                console.error("secure-image: download error", downloadError);
                return NextResponse.json({ error: "Không thể tải tài liệu gốc." }, { status: 500 });
            }

            pdfBuffer = Buffer.from(await buffer.arrayBuffer());

            // Add to cache & enforce size limit
            pdfBufferCache.set(cacheKey, { buffer: pdfBuffer, cachedAt: now });
            if (pdfBufferCache.size > MAX_CACHE_ENTRIES) {
                const oldestKey = pdfBufferCache.keys().next().value;
                if (oldestKey) pdfBufferCache.delete(oldestKey);
            }
        }

        // Forensic ID for steganography: combining wmShort and parts of deviceId for uniqueness
        const forensicId = `D2S:${access.ctx.watermark.wmShort}:${access.ctx.deviceId.slice(0, 4)}`;

        const imageBuffer = await rasterizePdfPage(pdfBuffer, page, {
            watermarkText: access.ctx.watermark.wmShort,
            forensicId: forensicId,
            scale: 2.0 // High res
        });

        // 4. Log success
        await access.ctx.logSuccess();

        // 5. Return image
        return new NextResponse(new Uint8Array(imageBuffer), {
            status: 200,
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "private, no-store",
                "X-D2S-WM-Short": access.ctx.watermark.wmShort,
                "X-D2S-Forensic": forensicId,
                "X-D2S-Request-ID": requestId,
            },
        });
    } catch (err) {
        console.error("secure-image error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Lỗi máy chủ." },
            { status: 500 }
        );
    }
}
