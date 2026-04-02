import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint for readiness/liveness probes.
 * Verifies Supabase connectivity by doing a minimal select.
 */
export async function GET() {
    const startedAt = Date.now();

    try {
        const supabase = createServiceRoleClient();

        // Minimal query to check DB availability
        const { error } = await supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .limit(1);

        if (error) {
            logger.error("Health check database error", { error: error.message });
            return NextResponse.json(
                {
                    status: "error",
                    database: "disconnected",
                    error: error.message,
                    latency_ms: Date.now() - startedAt
                },
                { status: 503 }
            );
        }

        logger.info("Health check success", { latency_ms: Date.now() - startedAt });

        return NextResponse.json(
            {
                status: "ok",
                database: "connected",
                timestamp: new Date().toISOString(),
                latency_ms: Date.now() - startedAt
            },
            { status: 200 }
        );
    } catch (err) {
        console.error("Health check unexpected error:", err);
        return NextResponse.json(
            {
                status: "error",
                error: err instanceof Error ? err.message : "Internal server error",
                latency_ms: Date.now() - startedAt
            },
            { status: 500 }
        );
    }
}
