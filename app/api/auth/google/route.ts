import { handle } from "../../../../lib/server";
export async function GET(request: Request) {
  return handle(request, async ctx => {
    const origin = new URL(request.url).origin;
    const { data, error } = await ctx.supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: origin+"/auth/callback", skipBrowserRedirect: true } });
    if(error || !data.url) return Response.json({error:"Could not start Google sign-in."},{status:503});
    return Response.redirect(data.url,303);
  });
}
