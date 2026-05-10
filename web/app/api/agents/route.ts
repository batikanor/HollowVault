/**
 * Agents are local-dev only — they need a persistent filesystem for the
 * audit log + per-agent KMS key cache. Vercel Lambdas have neither, so the
 * deployed routes return a structured "unavailable" payload that the UI can
 * render as a friendly notice instead of crashing on a 404 HTML page.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE = {
  agents: [],
  unavailable: true,
  reason: "Agent ops require local persistent storage. Run `npm run dev` to use the agents flow.",
  docsUrl: "https://github.com/batikanor/HollowVault#agents",
} as const;

export function GET() {
  return NextResponse.json(UNAVAILABLE);
}

export function POST() {
  return NextResponse.json(
    { error: "agents-unavailable", ...UNAVAILABLE },
    { status: 503 },
  );
}
