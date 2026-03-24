import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isPrivateOrUnknownIp } from "./ip-address.ts";

test("isPrivateOrUnknownIp identifies private and unknown addresses", () => {
  assert.equal(isPrivateOrUnknownIp("192.168.1.1"), true);
  assert.equal(isPrivateOrUnknownIp("10.0.0.1"), true);
  assert.equal(isPrivateOrUnknownIp("unknown"), true);
  assert.equal(isPrivateOrUnknownIp("8.8.8.8"), false);
});
