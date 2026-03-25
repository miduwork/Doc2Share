export type WatermarkVersion = "v1";

export type WatermarkDisplayPayload = {
  wmShort: string;
  wmDocShort: string;
  wmIssuedAtBucket: string;
  wmVersion: WatermarkVersion;
};

export type WatermarkForensicPayload = WatermarkDisplayPayload & {
  wmId: string;
};

export function toIssuedAtBucket(date: Date): string {
  return `${date.toISOString().slice(0, 16)}:00Z`;
}

export function toIssuedAtBucketLabel(bucket: string): string {
  if (!bucket) return "--:--";
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) {
    const normalized = bucket.trim();
    if (normalized.length >= 16) {
      return normalized.slice(11, 16);
    }
    return "--:--";
  }
  return date.toISOString().slice(11, 16);
}

export function hashDocumentShort(documentId: string, length = 8): string {
  const normalizedLength = Math.max(6, Math.min(8, Math.trunc(length)));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let hash = 0x811c9dc5;
  for (let i = 0; i < documentId.length; i += 1) {
    hash ^= documentId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  let out = "";
  let value = hash >>> 0;
  for (let i = 0; i < normalizedLength; i += 1) {
    out += alphabet[value % alphabet.length] ?? "X";
    value = Math.floor(value / alphabet.length);
    if (value === 0) value = (hash ^ (i + documentId.length + 1)) >>> 0;
  }
  return out;
}

export function buildDegradedWatermarkDisplayPayload(input: {
  documentId: string;
  deviceId: string;
  now?: Date;
}): WatermarkDisplayPayload {
  const now = input.now ?? new Date();
  const bucket = toIssuedAtBucket(now);
  const seed = `${input.documentId}:${input.deviceId}:${bucket}`;

  return {
    wmShort: hashDocumentShort(seed, 8).replace(/[89]/g, "7"),
    wmDocShort: hashDocumentShort(input.documentId, 8),
    wmIssuedAtBucket: bucket,
    wmVersion: "v1",
  };
}
