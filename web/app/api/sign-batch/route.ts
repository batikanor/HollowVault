import { NextResponse } from "next/server";
import { z } from "zod";
import { getCosmicEntropy } from "@/lib/server/orbitport";
import { signBatch } from "@/lib/server/batch";
import { getSigner, setupPayload } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BatchSchema = z.object({
  messages: z.array(z.string().min(1).max(4096)).min(1).max(50),
});

export async function POST(req: Request) {
  const setup = setupPayload();
  if (setup) {
    return NextResponse.json({ error: "signer setup required", ...setup }, { status: 503 });
  }
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const parsed = BatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", detail: parsed.error.format() },
      { status: 400 },
    );
  }

  try {
    const signer = await getSigner();
    const cosmic = await getCosmicEntropy();
    const result = await signBatch(signer, parsed.data.messages, cosmic);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/sign-batch] failed", err);
    return NextResponse.json({ error: "sign-batch failed", detail: String(err) }, { status: 500 });
  }
}
