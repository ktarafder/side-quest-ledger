import { env } from "cloudflare:workers";
import { database, handle, member, mediaEnabled } from "../../../../lib/server";
import { AppError } from "../../../../lib/rules";
export async function GET(request: Request, params: {params:Promise<{id:string}>}) {
  return handle(request,async ctx=>{
    const person=await member(ctx), {id}=await params.params;
    if(!mediaEnabled()) throw new AppError("Photos are not available yet.",503);
    const asset=await database().prepare("SELECT * FROM assets WHERE id=? AND status='ready' AND (owner_id=? OR EXISTS(SELECT 1 FROM submissions s JOIN quests q ON q.id=s.quest_id WHERE s.asset_id=assets.id AND q.deleted_at IS NULL) OR EXISTS(SELECT 1 FROM listings l WHERE l.asset_id=assets.id AND l.deleted_at IS NULL))").bind(id,person.id).first<{content_type:string}>();
    if(!asset || !env.BUCKET) throw new AppError("Photo not found.",404);
    const object=await env.BUCKET.get(id); if(!object) throw new AppError("Photo not found.",404);
    return new Response(object.body,{headers:{"Content-Type":asset.content_type,"Content-Disposition":"inline","X-Content-Type-Options":"nosniff"}});
  });
}
