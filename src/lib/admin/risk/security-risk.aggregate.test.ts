import { test } from "node:test";
import { strict as assert } from "node:assert";
import { aggregateHighRiskUsers } from "./security-risk.aggregate.ts";

test("aggregateHighRiskUsers returns sorted high risk users with threshold filter", () => {
  const result = aggregateHighRiskUsers({
    recentDevices: [
      { user_id: "u1", device_id: "d1" },
      { user_id: "u1", device_id: "d2" },
      { user_id: "u2", device_id: "d1" },
    ],
    access30m: [
      { user_id: "u1", status: "blocked", action: "secure_pdf", ip_address: "1.1.1.1", correlation_id: "c1" },
      { user_id: "u1", status: "blocked", action: "secure_pdf", ip_address: "2.2.2.2", correlation_id: "c1" },
      { user_id: "u2", status: "success", action: "secure_pdf", ip_address: "1.1.1.1", correlation_id: "c2" },
    ],
    access10m: [
      { user_id: "u1", action: "get_secure_link", document_id: "doc1", metadata: { reason: "rate_limit" } },
      { user_id: "u1", action: "get_secure_link", document_id: "doc2", metadata: { reason: "rate_limit" } },
    ],
    recentSecurity: [{ user_id: "u1", event_type: "ip_change", correlation_id: "c1" }],
    threshold: 20,
    limit: 10,
  });

  assert.equal(result.length >= 1, true);
  assert.equal(result[0]?.userId, "u1");
  assert.equal((result[0]?.score ?? 0) >= 20, true);
  assert.equal(result.every((x) => x.score >= 20), true);
});
