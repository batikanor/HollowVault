import { NextResponse } from "next/server";
import { verifyAttestation } from "@/lib/verify";
import type { Attestation } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const report = verifyAttestation(body as Attestation);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: "verification failed to run", detail: String(err) },
      { status: 400 },
    );
  }
}
