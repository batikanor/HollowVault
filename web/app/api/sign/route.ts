import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNER_URL = process.env.SIGNER_URL ?? "http://localhost:8080";

const SignRequest = z.object({
  message: z.string().min(1).max(4096),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = SignRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", detail: parsed.error.format() },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`${SIGNER_URL}/sign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "signer unreachable",
        detail: String(err),
        hint: `is the signer service running on ${SIGNER_URL}? try: docker compose up signer  (or: npm run dev:signer)`,
      },
      { status: 502 },
    );
  }
}
