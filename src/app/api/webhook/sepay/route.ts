import { NextResponse } from "next/server";
import {
    handleSePayWebhook,
    isSePayAuthorized,
    parseSePayJson,
} from "@/lib/webhooks/sepay";

export async function POST(request: Request) {
    // Audit log for all incoming webhook attempts
    console.log(`[Webhook] Incoming SePay request: ${request.method} ${request.url}`);

    if (!isSePayAuthorized(request)) {
        console.warn("[Webhook] SePay Unauthorized attempt", {
            auth: request.headers.get("Authorization")?.slice(0, 10) + "...",
            ua: request.headers.get("User-Agent"),
        });
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 },
        );
    }

    const parsed = await parseSePayJson(request);
    if (!parsed.ok) {
        return NextResponse.json(
            { success: false, error: parsed.error },
            { status: 400 },
        );
    }

    const result = await handleSePayWebhook(parsed.payload);
    if (!result.ok) {
        return NextResponse.json(
            { success: false, error: result.error },
            { status: result.status },
        );
    }

    return NextResponse.json(
        { success: true, message: result.message },
        { status: result.status },
    );
}
