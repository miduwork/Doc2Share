import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && serviceRoleKey);

test("P2: incidents table supports weekly review fields", { skip: !canRun }, async () => {
  const supabase = createClient(url!, serviceRoleKey!);
  const correlation = `p2-${Date.now()}`;
  const { error: insertError } = await supabase.from("security_incidents").insert({
    correlation_id: correlation,
    risk_score: 80,
    risk_band: "high",
    detection_source: "risk_engine_v1",
    review_status: "pending",
    metadata: { from: "integration" },
  });
  assert.ifError(insertError);

  const { data, error } = await supabase
    .from("security_incidents")
    .select("id, review_status, risk_score")
    .eq("correlation_id", correlation)
    .limit(1)
    .maybeSingle();
  assert.ifError(error);
  assert.equal(data?.review_status, "pending");
  assert.equal(data?.risk_score, 80);
});

test("P2: incident review fields persist after update", { skip: !canRun }, async () => {
  const supabase = createClient(url!, serviceRoleKey!);
  const correlation = `p2-review-${Date.now()}`;
  const { data: inserted, error: insertError } = await supabase
    .from("security_incidents")
    .insert({
      correlation_id: correlation,
      risk_score: 85,
      risk_band: "high",
      detection_source: "risk_engine_v1",
      review_status: "pending",
      metadata: { from: "integration-review" },
    })
    .select("id")
    .single();
  assert.ifError(insertError);
  assert.ok(inserted?.id);

  const { error: updateError } = await supabase
    .from("security_incidents")
    .update({
      review_status: "false_positive",
      reviewed_at: new Date().toISOString(),
      reviewed_by: "00000000-0000-0000-0000-000000000000",
      notes: "integration-note",
    })
    .eq("id", inserted!.id);
  assert.ifError(updateError);

  const { data, error } = await supabase
    .from("security_incidents")
    .select("review_status, reviewed_at, reviewed_by, notes")
    .eq("id", inserted!.id)
    .single();
  assert.ifError(error);
  assert.equal(data?.review_status, "false_positive");
  assert.equal(typeof data?.reviewed_at, "string");
  assert.equal(data?.reviewed_by, "00000000-0000-0000-0000-000000000000");
  assert.equal(data?.notes, "integration-note");
});
