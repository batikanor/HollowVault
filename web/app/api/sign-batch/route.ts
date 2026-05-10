import { NextResponse } from "next/server";
import { z } from "zod";
import { getCosmicEntropy, signBatch } from "@hollow-vault/core";
import { getSigner } from "@/lib/server/state";
import { failure, parseJsonBody, setupGuardResponse } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BatchSchema = z.object({
  messages: z.array(z.string().min(1).max(4096)).min(1).max(50),
});

export async function POST(req: Request) {
  const guard = setupGuardResponse();
  if (guard) return guard;

  const parsed = await parseJsonBody(req, BatchSchema);
  if (!parsed.ok) return parsed.res;

  try {
    const signer = await getSigner();
    const cosmic = await getCosmicEntropy();
    return NextResponse.json(await signBatch(signer, parsed.data.messages, cosmic));
  } catch (err) {
    return failure("sign-batch", err);
  }
}
