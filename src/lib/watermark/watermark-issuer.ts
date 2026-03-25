import "server-only";
import { randomBytes } from "node:crypto";
import {
  hashDocumentShort,
  toIssuedAtBucket,
  type WatermarkForensicPayload,
} from "@/lib/watermark/watermark-contract";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function toBase32(bytes: Uint8Array): string {
  let output = "";
  let value = 0;
  let bits = 0;

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]!;
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function issueWatermark(documentId: string, now = new Date()): WatermarkForensicPayload {
  const bytes = randomBytes(16);
  const wmId = bytes.toString("hex");
  const wmShort = toBase32(bytes).slice(0, 8);

  return {
    wmId,
    wmShort,
    wmDocShort: hashDocumentShort(documentId, 8),
    wmIssuedAtBucket: toIssuedAtBucket(now),
    wmVersion: "v1",
  };
}
