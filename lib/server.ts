import { env } from "cloudflare:workers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { AppError } from "./rules";
import { effectiveRole } from "./authorization";

export type Member = { id: string; auth_id: string; email: string; name: string; role: string; status: string; balance: number };
export function database(): D1Database {
  if (!env.DB) throw new AppError("The database is unavailable.", 503);
  return env.DB;
}
export function authConfigured() { return !!(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY); }
// Both controls must be present; provisioning a binding alone must not start object I/O.
export function mediaEnabled() { return env.MEDIA_STORAGE_ENABLED === "true" && !!env.BUCKET; }
export function context(request: Request) {
  if (!authConfigured()) throw new AppError("Google sign-in is being connected. Please come back soon.", 503);
  const pending: { name: string; value: string; options: CookieOptions }[] = [];
  const supabase = createServerClient(env.SUPABASE_URL!, env.SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/" },
    cookies: {
      getAll() {
        return (request.headers.get("cookie") || "").split(";").filter(Boolean).flatMap(part => {
          const index = part.indexOf("=");
          if (index < 1) return [];
          try { return [{ name: part.slice(0,index).trim(), value: decodeURIComponent(part.slice(index+1)) }]; } catch { return []; }
        });
      },
      setAll(values) { pending.push(...values); },
    },
  });
  return { request, supabase, pending };
}
export type Context = ReturnType<typeof context>;
export async function identity(ctx: Context) {
  const { data, error } = await ctx.supabase.auth.getUser();
  if (error || !data.user?.email || !data.user.email_confirmed_at || !data.user.identities?.some(x => x.provider === "google")) throw new AppError("Please sign in with Google.", 401);
  return data.user;
}
export async function member(ctx: Context): Promise<Member> {
  const user = await identity(ctx);
  const person = await database().prepare("SELECT * FROM members WHERE auth_id=? AND status='active'").bind(user.id).first<Member>();
  if (!person) throw new AppError("Complete the group questions to join.", 403);
  person.role = effectiveRole(person, user.email!, env.ADMIN_EMAIL);
  return person;
}
export function admin(person: Member) {
  if (person.role !== "admin") throw new AppError("Only Kamrul can use this action.", 403);
}
export async function rateLimit(key: string, limit = 100, seconds = 3600) {
  const now = Math.floor(Date.now()/1000), bucket = Math.floor(now/seconds);
  const result = await database().prepare("INSERT INTO rate_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count").bind(key+":"+bucket, now+seconds).first<{count:number}>();
  if (!result || result.count > limit) throw new AppError("Too many attempts. Please try again later.", 429);
  // Keep the counter table bounded; never log challenge answers or credentials.
  await database().prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(now-seconds).run();
}
export async function jsonBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AppError("Send JSON.", 415);
  if (Number(request.headers.get("content-length") || 0) > 16000) throw new AppError("Request too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Missing request.");
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if(size > 16000) { await reader.cancel(); throw new AppError("Request too large.",413); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for(const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.length; }
  let body; try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AppError("Invalid JSON."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError("Invalid request.");
  return body as Record<string, unknown>;
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") throw new AppError("Please use the app to make this change.",403);
}
function attachCookies(response: Response, ctx?: Context) {
  response = new Response(response.body, { status: response.status, headers: new Headers(response.headers) });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  if(ctx) for(const cookie of ctx.pending) {
    let value = cookie.name+"="+encodeURIComponent(cookie.value)+"; Path=/; HttpOnly; SameSite=Lax";
    if(new URL(ctx.request.url).protocol === "https:") value+="; Secure";
    if(cookie.options.maxAge !== undefined) value+="; Max-Age="+cookie.options.maxAge;
    if(cookie.options.expires) value+="; Expires="+cookie.options.expires.toUTCString();
    response.headers.append("Set-Cookie",value);
  }
  return response;
}
export async function handle(request: Request, run: (ctx: Context) => Promise<Response>) {
  let ctx: Context | undefined;
  try {
    if (!["GET","HEAD"].includes(request.method)) sameOrigin(request);
    ctx = context(request);
    return attachCookies(await run(ctx),ctx);
  } catch(error) {
    const known = error instanceof AppError;
    const conflict = /constraint|UNIQUE|CHECK|insufficient/i.test(error instanceof Error ? error.message : "");
    return attachCookies(Response.json({ error: known ? error.message : conflict ? "This changed while you were working. Refresh and try again." : "Could not complete that action. Please try again." }, { status: known ? error.status : conflict ? 409 : 500 }),ctx);
  }
}
