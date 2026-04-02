import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.SECURE_PDF_TEST_BASE_URL;
const cookie = process.env.SECURE_PDF_TEST_COOKIE;
const documentId = process.env.SECURE_PDF_TEST_DOCUMENT_ID;
const deviceId = process.env.SECURE_PDF_TEST_DEVICE_ID;

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(baseUrl && cookie && documentId && deviceId && supabaseUrl && serviceRoleKey);

function buildBody(params: {
  event_type: string;
  document_id: string;
  device_id: string;
  metadata?: Record<string, unknown>;
}) {
  return {
    event_type: params.event_type,
    document_id: params.document_id,
    device_id: params.device_id,
    metadata: params.metadata ?? {},
  };
}

async function fetchReaderObservability(payload: any, headers?: Record<string, string>) {
  const h = {
    "content-type": "application/json",
    cookie: cookie!,
    ...(headers ?? {}),
  };
  const res = await fetch(`${baseUrl}/api/reader-observability`, {
    method: "POST",
    headers: h,
    body: JSON.stringify(payload),
  });
  return res;
}

function toFloatOrNaN(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number.parseFloat(v);
  return Number.NaN;
}

test("POST /api/reader-observability: whitelist, schema, RPC side-effects, and throttling-by-user", { skip: !canRun }, async () => {
  const supabase = createClient(supabaseUrl!, serviceRoleKey!);

  // Use a tight time window to pick the correct rows.
  const sinceIso = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  // 1) Whitelist enforcement: unsupported event_type => 400
  {
    const res = await fetchReaderObservability(
      buildBody({ event_type: "unknown_event", document_id: documentId!, device_id: deviceId! }),
      { "x-forwarded-for": "127.0.0.10" }
    );
    assert.equal(res.status, 400);
    const json = await res.json().catch(() => ({}));
    assert.equal(json?.error, "Unsupported event_type");
  }

  // 2) Schema validation: invalid document_id => 400
  {
    const res = await fetchReaderObservability(
      buildBody({ event_type: "suspicious_behavior", document_id: "not-a-uuid", device_id: deviceId! }),
      { "x-forwarded-for": "127.0.0.11" }
    );
    assert.equal(res.status, 400);
    const json = await res.json().catch(() => ({}));
    assert.equal(json?.error, "document_id invalid");
  }

  // Helper to assert security_logs rows for suspicious behavior.
  async function assertSuspiciousAnomaly(params: {
    anomalyType: string;
    expectedRiskIncrement: number;
    expectedSuspiciousSeverity: "high" | "medium";
  }) {
    const res = await fetchReaderObservability(
      buildBody({
        event_type: "suspicious_behavior",
        document_id: documentId!,
        device_id: deviceId!,
        metadata: { anomaly_type: params.anomalyType },
      }),
      { "x-forwarded-for": "127.0.0.20" }
    );
    assert.equal(res.status, 200);

    // Find the latest suspicious_reader_behavior row for this anomaly.
    const { data: suspiciousRows, error: suspiciousErr } = await supabase
      .from("security_logs")
      .select("id,user_id,severity,metadata,created_at")
      .eq("event_type", "suspicious_reader_behavior")
      .eq("device_id", deviceId!)
      .filter("metadata->>anomaly_type", "eq", params.anomalyType)
      .filter("metadata->>document_id", "eq", documentId!)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5);

    assert.ifError(suspiciousErr);
    const suspicious = suspiciousRows?.[0];
    assert.ok(suspicious, "expected a suspicious_reader_behavior security_logs row");
    assert.equal(suspicious.severity, params.expectedSuspiciousSeverity);

    const storedRiskInc = toFloatOrNaN((suspicious.metadata as any)?.risk_increment);
    assert.ok(Number.isFinite(storedRiskInc), "risk_increment should be present in metadata");
    assert.equal(storedRiskInc, params.expectedRiskIncrement);

    // Find the latest RPC-driven risk_score_increment row with the same increment.
    const { data: riskRows, error: riskErr } = await supabase
      .from("security_logs")
      .select("id,user_id,severity,metadata,created_at")
      .eq("event_type", "risk_score_increment")
      .eq("user_id", suspicious.user_id)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5);

    assert.ifError(riskErr);
    const risk = riskRows?.find((r) => toFloatOrNaN((r.metadata as any)?.increment) === params.expectedRiskIncrement);
    assert.ok(risk, "expected a risk_score_increment security_logs row matching increment");

    const storedIncrement = toFloatOrNaN((risk.metadata as any)?.increment);
    assert.equal(storedIncrement, params.expectedRiskIncrement);

    const storedReason = String((risk.metadata as any)?.reason ?? "");
    assert.match(storedReason, new RegExp(params.anomalyType));
  }

  // expected mapping in route:
  // - robotic_regularity => riskIncrement 2.0 => suspicious severity high
  await assertSuspiciousAnomaly({ anomalyType: "robotic_regularity", expectedRiskIncrement: 2.0, expectedSuspiciousSeverity: "high" });

  // - high_frequency_flipping => riskIncrement 1.0 => suspicious severity high
  await assertSuspiciousAnomaly({ anomalyType: "high_frequency_flipping", expectedRiskIncrement: 1.0, expectedSuspiciousSeverity: "high" });

  // - unknown anomaly => default riskIncrement 0.5 => suspicious severity medium
  await assertSuspiciousAnomaly({ anomalyType: "some_other_anomaly", expectedRiskIncrement: 0.5, expectedSuspiciousSeverity: "medium" });

  // 3) Throttling: keyed by user_id, so changing x-forwarded-for should NOT bypass.
  {
    let seen429 = false;
    // We do more than MAX_EVENTS_PER_WINDOW (10) to ensure we exceed it.
    for (let i = 0; i < 15; i += 1) {
      const res = await fetchReaderObservability(
        buildBody({
          event_type: "suspicious_behavior",
          document_id: documentId!,
          device_id: deviceId!,
          metadata: { anomaly_type: "high_frequency_flipping" },
        }),
        { "x-forwarded-for": `127.0.0.${200 + i}` }
      );
      if (res.status === 429) {
        seen429 = true;
        break;
      }
    }
    assert.equal(seen429, true, "expected at least one 429 when throttling is keyed by user_id");
  }
});

