#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);
const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

async function timed(label, fn) {
  const start = performance.now();
  const result = await fn();
  const elapsedMs = Math.round(performance.now() - start);
  if (result.error) {
    console.error(`${label}: FAILED in ${elapsedMs}ms - ${result.error.message}`);
    return;
  }
  const count = Array.isArray(result.data) ? result.data.length : 0;
  console.log(`${label}: ${elapsedMs}ms (${count} rows)`);
}

await timed("access_logs 30d latest", () =>
  supabase
    .from("access_logs")
    .select("id, created_at, correlation_id")
    .gte("created_at", from)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(200)
);

await timed("security_logs 30d latest", () =>
  supabase
    .from("security_logs")
    .select("id, created_at, correlation_id")
    .gte("created_at", from)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(200)
);

await timed("correlation lookup sample", () =>
  supabase
    .from("access_logs")
    .select("id, correlation_id, created_at")
    .not("correlation_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200)
);
