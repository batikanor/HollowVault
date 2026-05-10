import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  return NextResponse.json(
    {
      agentId,
      error: "agents-unavailable",
      reason: "Agent ops require local persistent storage. Run `npm run dev` to use the agents flow.",
    },
    { status: 503 },
  );
}
