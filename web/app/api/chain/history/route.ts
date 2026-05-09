import { NextResponse } from "next/server";
import { readRecentAttestations } from "@/lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await readRecentAttestations(50);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { error: "history read failed", detail: String(err), items: [] },
      { status: 200 },
    );
  }
}
