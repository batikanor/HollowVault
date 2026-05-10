import { NextResponse } from "next/server";
import { currentMode, getSigner, mockSatellitePublicKey, setupPayload } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const mode = currentMode();
  const setup = setupPayload();
  if (setup) {
    return NextResponse.json({ mode, signerType: null, address: null, ...setup });
  }
  try {
    const s = await getSigner();
    return NextResponse.json({
      mode,
      signerType: s.identity.signerType,
      address: s.identity.address,
      publicKey: s.identity.publicKey,
      keyId: s.identity.keyId,
      createdAt: s.identity.createdAt,
      mockSatellitePublicKey: mockSatellitePublicKey(),
      capabilities: ["sign", "sign-typed", "sign-batch"],
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
