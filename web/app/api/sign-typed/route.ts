import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCosmicEntropy,
  signTypedAttestation,
  type EIP712TypedData,
} from "@hollow-vault/core";
import { getSigner } from "@/lib/server/state";
import { failure, parseJsonBody, setupGuardResponse } from "@/lib/api-helpers";

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
  const guard = setupGuardResponse();
  if (guard) return guard;

  const parsed = await parseJsonBody(req, TypedSchema);
  if (!parsed.ok) return parsed.res;

  try {
    const signer = await getSigner();
    const cosmic = await getCosmicEntropy();
    return NextResponse.json(
      await signTypedAttestation(signer, parsed.data as EIP712TypedData, cosmic),
    );
  } catch (err) {
    return failure("sign-typed", err);
  }
}
