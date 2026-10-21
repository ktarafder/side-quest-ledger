import { database, handle, member, jsonBody, rateLimit } from "../../../lib/server";
import { mutate } from "../../../lib/domain";
export async function POST(request: Request) {
  return handle(request,async ctx=>{
    const person=await member(ctx);
    await rateLimit("mutation:"+person.id,180);
    const body=await jsonBody(request);
    const result=await mutate(database(),person,body,request.headers.get("idempotency-key") || "");
    return Response.json(result);
  });
}
