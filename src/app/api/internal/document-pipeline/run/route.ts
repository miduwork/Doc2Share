import { NextResponse } from "next/server";
import { createDocumentPipelineRepository } from "@/lib/domain/document-pipeline";

export async function POST(req: Request) {
  const secret = process.env.INTERNAL_CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 20));
  try {
    const repository = createDocumentPipelineRepository();
    const row = await repository.runTick(limit);
    return NextResponse.json({
      claimed: row.claimed,
      completed: row.completed,
      failed: row.failed,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 });
  }
}
