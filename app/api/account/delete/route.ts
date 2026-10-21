import { env } from "cloudflare:workers";
import { database, handle, identity, jsonBody, rateLimit } from "../../../../lib/server";
import { accountFingerprint, closeAccount } from "../../../../lib/account";
import { assignReviews } from "../../../../lib/domain";
import { AppError } from "../../../../lib/rules";

export async function POST(request:Request) {
  return handle(request,async ctx=>{
    const user=await identity(ctx), body=await jsonBody(request);
    if(body.confirmation!=="DELETE") throw new AppError("Type DELETE to confirm.");
    await rateLimit("delete-account:"+user.id,10);
    const fingerprint=await accountFingerprint(user.email!,env.ACCOUNT_HASH_SECRET||"");
    const {data:{session}}=await ctx.supabase.auth.getSession();
    if(!session?.access_token) throw new AppError("Please sign in again.",401);
    await closeAccount(database(),user.id,fingerprint);
    const response=await fetch(env.SUPABASE_URL+"/functions/v1/delete-ledger-account",{
      method:"POST",headers:{Authorization:"Bearer "+session.access_token,apikey:env.SUPABASE_PUBLISHABLE_KEY!,"X-Confirm-Deletion":"DELETE"},signal:AbortSignal.timeout(20000),
    }).catch(()=>null);
    if(!response?.ok) throw new AppError("Your ledger profile is closed. Account deletion still needs to finish. Retry here or sign in again to finish.",503);
    for(const part of (request.headers.get("cookie")||"").split(";")) {
      const name=part.split("=",1)[0].trim();
      if(/^sb-[a-zA-Z0-9_.-]+$/.test(name)) ctx.pending.push({name,value:"",options:{maxAge:0}});
    }
    await assignReviews(database()).catch(()=>{});
    return Response.json({ok:true});
  });
}
