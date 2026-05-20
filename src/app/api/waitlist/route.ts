import { NextResponse } from "next/server";

import { submitToWaitlist } from "@/lib/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const input =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const result = await submitToWaitlist({
    email: String(input.email ?? ""),
    source: typeof input.source === "string" ? input.source : undefined,
    referrer: typeof input.referrer === "string" ? input.referrer : undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.error === "invalid_email" ? 400 : 500 });
  }
  return NextResponse.json(result, { status: 200 });
}
