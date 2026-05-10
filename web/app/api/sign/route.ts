import { NextResponse } from "next/server";
import { z } from "zod";
import { getCosmicEntropy } from "@/lib/server/orbitport";
import { signAttestation } from "@/lib/server/attestation";
import { getSigner, setupPayload } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SignRequest = z.object({ message: z.string().min(1).max(4096) });

export async function POST(req: Request) {
  const setup = setupPayload();
  if (setup) {
    return NextResponse.json({ error: "signer setup required", ...setup }, { status: 503 });
  }
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const parsed = SignRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", detail: parsed.error.format() },
      { status: 400 },
    );
  }

  try {
    const signer = await getSigner();
    const cosmic = await getCosmicEntropy();
    const attestation = await signAttestation(signer, parsed.data.message, cosmic);
    return NextResponse.json(attestation);
  } catch (err) {
    console.error("[api/sign] failed", err);
    return NextResponse.json({ error: "sign failed", detail: String(err) }, { status: 500 });
  }
}
