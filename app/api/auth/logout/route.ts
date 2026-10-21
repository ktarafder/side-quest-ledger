import { handle } from "../../../../lib/server";
export async function POST(request: Request) { return handle(request, async ctx => { await ctx.supabase.auth.signOut(); return Response.json({ok:true}); }); }
