// @ts-nocheck
// resolve-ott: Single-use signed URL resolver
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

function allowedOrigins(): string[] {
    const raw = Deno.env.get("SECURE_LINK_ALLOWED_ORIGINS") ?? "";
    const parsed = raw
        .split(",")
        .map((origin: string) => origin.trim())
        .filter((origin: string) => origin.length > 0);
    return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
}

function corsHeadersForRequest(req: Request): Record<string, string> {
    const requestOrigin = req.headers.get("origin");
    const origins = allowedOrigins();
    const allowOrigin =
        requestOrigin && origins.includes(requestOrigin)
            ? requestOrigin
            : origins[0];

    return {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        Vary: "Origin",
    };
}

serve(async (req) => {
    const requestId = req.headers.get("x-request-id") || crypto.randomUUID();

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeadersForRequest(req) });
    }

    const url = new URL(req.url);
    const nonce = url.searchParams.get("token");

    if (!nonce) {
        return new Response(JSON.stringify({ error: "Token is required" }), {
            status: 400,
            headers: { ...corsHeadersForRequest(req), "Content-Type": "application/json" },
        });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    try {
        // 1) Atomic "mark used" (prevents race between 2 concurrent requests)
        // Only succeeds for a not-used, not-expired nonce.
        const nowIso = new Date().toISOString();
        const {
            data: updatedOttRows,
            error: updateError,
        } = await supabase
            .from("ott_nonces")
            .update({ used: true })
            .eq("id", nonce)
            .eq("used", false)
            .gt("expires_at", nowIso)
            .select("storage_path");

        if (updateError) {
            throw updateError;
        }

        const updatedOtt = Array.isArray(updatedOttRows)
            ? updatedOttRows[0]
            : updatedOttRows;

        if (!updatedOtt?.storage_path) {
            // Follow-up classification (what failed?) when atomic update matched 0 rows.
            const { data: existingOtt, error: ottError } = await supabase
                .from("ott_nonces")
                .select("used, expires_at")
                .eq("id", nonce)
                .maybeSingle();

            if (ottError || !existingOtt) {
                return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
                    status: 403,
                    headers: { ...corsHeadersForRequest(req), "Content-Type": "application/json" },
                });
            }

            if (existingOtt.used) {
                return new Response(JSON.stringify({ error: "Token already used" }), {
                    status: 410,
                    headers: { ...corsHeadersForRequest(req), "Content-Type": "application/json" },
                });
            }

            if (new Date(existingOtt.expires_at) < new Date()) {
                return new Response(JSON.stringify({ error: "Token expired" }), {
                    status: 410,
                    headers: { ...corsHeadersForRequest(req), "Content-Type": "application/json" },
                });
            }

            // Should be rare: conditions are satisfied but atomic update didn't return a row.
            return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
                status: 403,
                headers: { ...corsHeadersForRequest(req), "Content-Type": "application/json" },
            });
        }

        // 2) Create real signed URL (very short TTL: 5s)
        const { data: signedData, error: signError } = await supabase.storage
            .from("private_documents")
            .createSignedUrl(updatedOtt.storage_path, 5);

        if (signError || !signedData?.signedUrl) {
            return new Response(JSON.stringify({ error: "Failed to generate download link" }), {
                status: 500,
                headers: { ...corsHeadersForRequest(req), "Content-Type": "application/json" },
            });
        }

        // 4. Redirect to the real storage URL
        return new Response(null, {
            status: 302,
            headers: {
                Location: signedData.signedUrl,
                ...corsHeadersForRequest(req),
            },
        });
    } catch (err) {
        console.error("resolve-ott error:", err);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { ...corsHeadersForRequest(req), "Content-Type": "application/json" },
        });
    }
});
