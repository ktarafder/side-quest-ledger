import { configuredPassword, createSessionToken, sessionCookie } from "../../../../lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const expected = configuredPassword();

  if (!expected || body.password !== expected) {
    return Response.json({ error: "That key does not open this board." }, { status: 401 });
  }

  const token = await createSessionToken();
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": sessionCookie(token), "Cache-Control": "no-store" } }
  );
}
