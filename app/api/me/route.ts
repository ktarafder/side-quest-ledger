import { env } from "cloudflare:workers";
import { effectiveRole } from "../../../lib/authorization";
import type { Member } from "../../../lib/server";
import { authConfigured, handle, identity, database } from "../../../lib/server";
export async function GET(request: Request) {
  if(!authConfigured()) return Response.json({configured:false},{headers:{"Cache-Control":"no-store"}});
  return handle(request, async ctx => {
    const user=await identity(ctx);
    const deleting=!!await database().prepare("SELECT auth_id FROM account_deletions WHERE auth_id=?").bind(user.id).first();
    const person=await database().prepare("SELECT id,name,email,role,status,balance FROM members WHERE auth_id=?").bind(user.id).first<Member>();
    if(person) person.role=effectiveRole(person,user.email!,env.ADMIN_EMAIL);
    return Response.json({configured:true,member:person,authenticated:true,deleting});
  });
}
