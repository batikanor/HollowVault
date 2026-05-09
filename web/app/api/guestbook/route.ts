import { NextResponse } from "next/server";
import { appendEntry, listEntries } from "@/lib/guestbook";
import type { Attestation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ entries: listEntries(100) });
}

export async function POST(req: Request) {
  let att: Attestation;
  try {
    att = (await req.json()) as Attestation;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const entry = appendEntry(att);
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 400 });
  }
}
