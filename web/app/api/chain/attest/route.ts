import { NextResponse } from "next/server";
import { submitAttestationOnchain } from "@/lib/chain";
import type { Attestation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let att: Attestation;
  try {
    att = (await req.json()) as Attestation;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!att?.signature || !att?.messageHash || !att?.cosmic?.seed) {
    return NextResponse.json({ error: "missing required attestation fields" }, { status: 400 });
  }
  try {
    const result = await submitAttestationOnchain(att);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "on-chain submission failed", detail: String(err) },
      { status: 500 },
    );
  }
}
