import { database, handle, identity } from "../../../../lib/server";
export async function GET(request:Request) {
  return handle(request,async ctx=>{
    const authorization=request.headers.get("authorization")||"";
    const token=authorization.startsWith("Bearer ")?authorization.slice(7):undefined;
    const user=await identity(ctx,token);
    const ready=!!await database().prepare("SELECT auth_id FROM account_deletions WHERE auth_id=?").bind(user.id).first();
    return Response.json({ready});
  });
}
