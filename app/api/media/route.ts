import { env } from "cloudflare:workers";
import { database, handle, member, mediaEnabled, rateLimit } from "../../../lib/server";
import { AppError } from "../../../lib/rules";
function contentType(bytes: Uint8Array) {
  if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return "image/jpeg";
  if(bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71) return "image/png";
  if(new TextDecoder().decode(bytes.slice(0,4))==="RIFF" && new TextDecoder().decode(bytes.slice(8,12))==="WEBP") return "image/webp";
  return null;
}
export async function POST(request: Request) {
  return handle(request,async ctx=>{
    const person=await member(ctx);
    if(!mediaEnabled() || !env.BUCKET) throw new AppError("Photos are not available yet. You can still post without one.",503);
    await rateLimit("uploads:"+person.id,30,86400);
    const length=Number(request.headers.get("content-length") || 0);
    if(length>2097152) throw new AppError("Photos must be under 2 MB.",413);
    const reader=request.body?.getReader(); if(!reader) throw new AppError("Missing photo.");
    const chunks: Uint8Array[]=[]; let size=0;
    while(true) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>2097152){await reader.cancel();throw new AppError("Photos must be under 2 MB.",413);} chunks.push(value); }
    const bytes=new Uint8Array(size); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const type=contentType(bytes); if(!type || !size) throw new AppError("Use a JPEG, PNG, or WebP photo.");
    const id=crypto.randomUUID(),db=database();
    await db.batch([
      db.prepare("INSERT INTO assets(id,owner_id,size,content_type) VALUES(?,?,?,?)").bind(id,person.id,size,type),
      db.prepare("INSERT INTO operation_checks(ok) SELECT CASE WHEN (SELECT SUM(size) FROM assets)<=8589934592 THEN 1 ELSE 0 END"),
      db.prepare("DELETE FROM operation_checks"),
    ]);
    try {
      await env.BUCKET.put(id,bytes,{httpMetadata:{contentType:type}});
      await db.prepare("UPDATE assets SET status='ready' WHERE id=?").bind(id).run();
    } catch {
      // Retain the reservation if object cleanup cannot be confirmed.
      // An orphan must continue counting toward the storage ceiling.
      let removed=false;
      try { await env.BUCKET.delete(id); removed=true; } catch {}
      if(removed) await db.prepare("DELETE FROM assets WHERE id=?").bind(id).run();
      throw new AppError("Could not save the photo. Try again.",503);
    }
    return Response.json({id},{status:201});
  });
}
