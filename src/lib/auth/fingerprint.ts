/**
 * FingerprintCollector: Thu thập tín hiệu phần cứng để nhận diện thiết bị.
 * Mục tiêu: Tạo ra một "Hardware Hash" ổn định qua các lần xóa localStorage.
 *
 * Design decisions (P1-P2 fixes):
 * - Cache result per page lifecycle to avoid re-computing on every fetch
 * - Only hash STABLE signals (WebGL renderer/vendor, screen, audio sampleRate)
 * - Exclude volatile values: Canvas toDataURL (changes with GPU driver updates),
 *   AudioContext.state (non-deterministic "running" vs "suspended")
 * - Export lightweight signalsSummary for DB storage instead of raw base64
 */

type FingerprintResult = {
    /** Lightweight summary for DB storage — no heavy base64 data */
    signalsSummary: Record<string, unknown>;
    /** SHA-256 hash of stable signals only */
    hardwareHash: string;
};

let cachedResult: FingerprintResult | null = null;

export async function collectHardwareFingerprint(): Promise<FingerprintResult> {
    if (cachedResult) return cachedResult;

    const stableSignals: Record<string, unknown> = {};
    const summarySignals: Record<string, unknown> = {};

    // 1. Canvas Fingerprinting — hash pixel data, don't store raw toDataURL
    try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
            canvas.width = 200;
            canvas.height = 50;
            ctx.textBaseline = "top";
            ctx.font = "14px 'Arial'";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#f60";
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = "#069";
            ctx.fillText("Doc2Share <canvas> 1.0", 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText("Doc2Share <canvas> 1.0", 4, 17);
            // Hash the pixel data for stability instead of toDataURL (which varies with GPU drivers)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixelHash = await hashBytes(imageData.data);
            stableSignals.canvasHash = pixelHash;
            summarySignals.canvasHash = pixelHash;
        }
    } catch {
        stableSignals.canvasHash = "error";
        summarySignals.canvasHash = "error";
    }

    // 2. WebGL Fingerprinting — renderer & vendor are stable across sessions
    try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (gl instanceof WebGLRenderingContext) {
            const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
            if (debugInfo) {
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                stableSignals.renderer = renderer;
                stableSignals.vendor = vendor;
                summarySignals.renderer = renderer;
                summarySignals.vendor = vendor;
            }
        }
    } catch {
        stableSignals.webgl = "error";
        summarySignals.webgl = "error";
    }

    // 3. Screen & Basic Metrics — stable across sessions
    const screenInfo = {
        w: window.screen.width,
        h: window.screen.height,
        cd: window.screen.colorDepth,
        pr: window.devicePixelRatio,
    };
    stableSignals.screen = screenInfo;
    summarySignals.screen = screenInfo;

    // 4. Audio Fingerprinting — only sampleRate is stable; exclude state (volatile)
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        stableSignals.audioSampleRate = audioCtx.sampleRate;
        summarySignals.audioSampleRate = audioCtx.sampleRate;
        audioCtx.close();
    } catch {
        stableSignals.audioSampleRate = "error";
        summarySignals.audioSampleRate = "error";
    }

    // Hash only STABLE signals for consistency
    const signalsStr = JSON.stringify(stableSignals);
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signalsStr));
    const hardwareHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    cachedResult = {
        signalsSummary: summarySignals,
        hardwareHash,
    };

    return cachedResult;
}

async function hashBytes(data: Uint8ClampedArray): Promise<string> {
    const buffer = await crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer);
    return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 16); // short hash is sufficient for fingerprinting
}
