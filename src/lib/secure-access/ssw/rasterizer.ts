import "server-only";
import { encodeStego } from "@/lib/watermark/stego-encoder";

type NapiCanvas = typeof import("@napi-rs/canvas");
type PdfJsLegacy = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let napiCanvasPromise: Promise<NapiCanvas> | undefined;
let pdfjsPromise: Promise<PdfJsLegacy> | undefined;

async function getNapiCanvas(): Promise<NapiCanvas> {
    napiCanvasPromise ??= import(/* webpackIgnore: true */ "@napi-rs/canvas");
    return napiCanvasPromise;
}

/** Legacy build avoids browser-only APIs (e.g. DOMMatrix) during Node / next build. */
async function getPdfjs(): Promise<PdfJsLegacy> {
    pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
    return pdfjsPromise;
}
/**
 * Rasterizes a single page of a PDF document from a buffer.
 * Applies visible watermark and invisible steganography.
 */
export async function rasterizePdfPage(
    pdfBuffer: Buffer,
    pageNumber: number,
    options: {
        watermarkText: string;
        forensicId: string;
        scale?: number;
    }
): Promise<Buffer> {
    const { watermarkText, forensicId, scale = 2.0 } = options;

    const { createCanvas } = await getNapiCanvas();
    const pdfjs = await getPdfjs();

    // 1. Load PDF
    const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(pdfBuffer),
        useSystemFonts: true,
        isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;

    if (pageNumber < 1 || pageNumber > pdf.numPages) {
        throw new Error(`Trang ${pageNumber} không tồn tại.`);
    }

    // 2. Load Page
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    // 3. Create Canvas (@napi-rs/canvas)
    const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
    const context = canvas.getContext("2d");

    // 4. Render PDF to Canvas
    // Note: pdfjs-dist expects a DOM-like canvas or a node-canvas compatible object.
    // @napi-rs/canvas is mostly compatible.
    await page.render({
        canvasContext: context as any,
        viewport,
    }).promise;

    // 5. Apply Visible Watermark (Burned-in)
    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(-Math.PI / 4);
    context.font = `${Math.floor(canvas.width / 15)}px sans-serif`;
    context.fillStyle = "rgba(128, 128, 128, 0.15)";
    context.textAlign = "center";

    // Patterned watermark
    for (let y = -canvas.height; y < canvas.height; y += 200) {
        for (let x = -canvas.width; x < canvas.width; x += 300) {
            context.fillText(watermarkText, x, y);
        }
    }
    context.restore();

    // 6. Apply Invisible Watermarking (Steganography)
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const stegoPixels = encodeStego(imageData.data, forensicId);

    // We can't directly use putImageData if we want to preserve the high-perf buffer,
    // but for simplicity and safety:
    context.putImageData(imageData as any, 0, 0); // Note: encodeStego modifies in-place or returns a copy
    // Wait, encodeStego returns a new Uint8ClampedArray. I should put it back.
    imageData.data.set(stegoPixels);
    context.putImageData(imageData as any, 0, 0);

    // 7. Export to PNG buffer
    const imageBuffer = await canvas.encode("png");

    return imageBuffer;
}
