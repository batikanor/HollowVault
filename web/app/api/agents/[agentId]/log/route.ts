import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  return params.then(({ agentId }) =>
    NextResponse.json({
      agentId,
      entries: [],
      spentTodayWei: "0",
      unavailable: true,
      reason: "Agent ops require local persistent storage. Run `npm run dev` to use the agents flow.",
    }),
  );
}
