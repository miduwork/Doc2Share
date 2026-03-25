import { NextResponse } from "next/server";
import { publicConfig } from "@/lib/config/public";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const amount = url.searchParams.get("amount");
  const addInfo = url.searchParams.get("addInfo") ?? "";

  if (!amount) {
    return NextResponse.json(
      { error: "Missing amount query param" },
      { status: 400 },
    );
  }

  const { bankId, accountNo } = publicConfig.vietqr;
  const remoteUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${encodeURIComponent(
    amount,
  )}&addInfo=${encodeURIComponent(addInfo)}`;

  const res = await fetch(remoteUrl);
  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch QR image" },
      { status: 502 },
    );
  }

  const contentType = res.headers.get("content-type") ?? "image/png";
  const buffer = await res.arrayBuffer();

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="qr-${amount}.png"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}

