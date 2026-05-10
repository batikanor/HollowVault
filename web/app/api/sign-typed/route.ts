import { NextResponse } from "next/server";
import { z } from "zod";
import { getCosmicEntropy } from "@/lib/server/orbitport";
import { signTypedAttestation, type EIP712TypedData } from "@/lib/server/typed";
import { getSigner, setupPayload } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TypedSchema = z.object({
  domain: z.record(z.unknown()),
  types: z.record(z.array(z.object({ name: z.string(), type: z.string() }))),
  primaryType: z.string(),
  message: z.record(z.unknown()),
});

export async function POST(req: Request) {
  const setup = setupPayload();
  if (setup) {
    return NextResponse.json({ error: "signer setup required", ...setup }, { status: 503 });
  }
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const parsed = TypedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", detail: parsed.error.format() },
      { status: 400 },
    );
  }

  try {
    const signer = await getSigner();
    const cosmic = await getCosmicEntropy();
    const attestation = await signTypedAttestation(signer, parsed.data as EIP712TypedData, cosmic);
    return NextResponse.json(attestation);
  } catch (err) {
    console.error("[api/sign-typed] failed", err);
    return NextResponse.json({ error: "sign-typed failed", detail: String(err) }, { status: 500 });
  }
}
