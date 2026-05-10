import { NextResponse } from "next/server";
import { z } from "zod";
import { getCosmicEntropy, signAttestation } from "@hollow-vault/core";
import { getSigner } from "@/lib/server/state";
import { failure, parseJsonBody, setupGuardResponse } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SignSchema = z.object({ message: z.string().min(1).max(4096) });

export async function POST(req: Request) {
  const guard = setupGuardResponse();
  if (guard) return guard;

  const parsed = await parseJsonBody(req, SignSchema);
  if (!parsed.ok) return parsed.res;

  try {
    const signer = await getSigner();
    const cosmic = await getCosmicEntropy();
    return NextResponse.json(await signAttestation(signer, parsed.data.message, cosmic));
  } catch (err) {
    return failure("sign", err);
  }
}
