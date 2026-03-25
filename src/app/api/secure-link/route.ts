import { NextResponse } from "next/server";

export async function POST(_req: Request) {
  const sunsetAt = "Wed, 30 Apr 2026 00:00:00 GMT";
  const response = NextResponse.json(
    {
      error: "Endpoint /api/secure-link da ngung hoat dong. Vui long su dung luong doc qua /api/secure-pdf.",
      code: "ENDPOINT_DEPRECATED",
    },
    { status: 410 }
  );
  response.headers.set("Deprecation", "true");
  response.headers.set("Sunset", sunsetAt);
  response.headers.set("Link", '</api/secure-pdf>; rel="successor-version"');
  return response;
}
