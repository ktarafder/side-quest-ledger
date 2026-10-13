import { clearedSessionCookie } from "../../../../lib/auth";

export async function POST() {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearedSessionCookie(), "Cache-Control": "no-store" } }
  );
}
