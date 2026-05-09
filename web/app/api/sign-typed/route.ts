import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNER_URL = process.env.SIGNER_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  try {
    const upstream = await fetch(`${SIGNER_URL}/sign-typed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "signer unreachable", detail: String(err), hint: `is the signer running on ${SIGNER_URL}?` },
      { status: 502 },
    );
  }
}
