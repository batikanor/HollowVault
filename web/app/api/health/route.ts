import { NextResponse } from "next/server";
import { currentMode } from "@/lib/server/orbitport";
import { getSigner, setupPayload } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const mode = currentMode();
  const setup = setupPayload();
  if (setup) {
    return NextResponse.json({ ok: false, mode, ...setup });
  }
  try {
    const s = await getSigner();
    return NextResponse.json({
      ok: true,
      mode,
      signerType: s.identity.signerType,
      address: s.identity.address,
      keyId: s.identity.keyId,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, mode, error: String(err) }, { status: 500 });
  }
}
