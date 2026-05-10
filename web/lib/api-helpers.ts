import { NextResponse } from "next/server";
import type { z } from "zod";
import { setupPayload } from "@/lib/server/state";

/** Returns a 503 response if credentials are missing, else null. */
export function setupGuardResponse(): NextResponse | null {
  const setup = setupPayload();
  if (!setup) return null;
  return NextResponse.json({ error: "signer setup required", ...setup }, { status: 503 });
}

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; res: NextResponse };

/**
 * Parses a JSON body and validates it against a zod schema. Returns either
 * the parsed data or a ready-to-return 400 response — letting routes stay
 * a flat sequence of guard / parse / do-the-work.
 */
export async function parseJsonBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<ParseResult<z.infer<S>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, res: NextResponse.json({ error: "invalid json" }, { status: 400 }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "invalid request", detail: parsed.error.format() },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

export function failure(label: string, err: unknown): NextResponse {
  console.error(`[api/${label}] failed`, err);
  return NextResponse.json({ error: `${label} failed`, detail: String(err) }, { status: 500 });
}
