import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export function signDiagnosticsPayload(payload: Record<string, string>, secret: string): string {
  const canonical = canonicalize(payload);
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

export function verifyDiagnosticsPayload(
  payload: Record<string, string>,
  providedSignature: string,
  secret: string
): boolean {
  if (!providedSignature) return false;
  const expected = signDiagnosticsPayload(payload, secret);
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(providedSignature, "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

function canonicalize(payload: Record<string, string>): string {
  return Object.keys(payload)
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join("&");
}
