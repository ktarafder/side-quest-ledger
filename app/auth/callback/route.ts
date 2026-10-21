import { handle } from "../../../lib/server";
export async function GET(request: Request) {
  return handle(request, async ctx => {
    const url = new URL(request.url), code = url.searchParams.get("code");
    if(!code) return Response.redirect(url.origin+"/?auth=failed",303);
    const { error } = await ctx.supabase.auth.exchangeCodeForSession(code);
    return Response.redirect(url.origin+(error ? "/?auth=failed" : "/"),303);
  });
}
