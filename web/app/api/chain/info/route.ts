import { NextResponse } from "next/server";
import { getDeploymentInfo } from "@/lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const info = getDeploymentInfo();
  if (!info) {
    return NextResponse.json(
      {
        deployed: false,
        hint: "no deployment artifact at .runtime/deployment.json — run `npm run deploy:local`",
      },
      { status: 200 },
    );
  }
  return NextResponse.json({ deployed: true, ...info });
}
