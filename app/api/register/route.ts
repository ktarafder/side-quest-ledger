import { registrationRole } from "../../../lib/authorization";
import { env } from "cloudflare:workers";
import { database, handle, identity, jsonBody, rateLimit } from "../../../lib/server";
import { AppError, text, answerMatches, shuffled } from "../../../lib/rules";
import { assignReviews } from "../../../lib/domain";
type Question = { id:string; question:string; answers:string[]; unordered?:boolean };
function pool(): Question[] {
  let values; try { values=JSON.parse(env.GROUP_QUIZ_JSON || "null"); } catch { throw new AppError("Registration questions are being configured.",503); }
  if(!Array.isArray(values) || values.length<3 || !values.every(q=>q && typeof q.id==="string" && typeof q.question==="string" && Array.isArray(q.answers) && q.answers.length && q.answers.every((a:unknown)=>typeof a==="string"))) throw new AppError("Registration questions are being configured.",503);
  return values;
}
export async function GET(request: Request) {
  return handle(request, async ctx=>{
    const user=await identity(ctx);
    await rateLimit("quiz-create:"+user.id,5);
    await rateLimit("quiz-network:"+request.headers.get("cf-connecting-ip"),30);
    const questions=shuffled(pool()).slice(0,3), id=crypto.randomUUID(), now=Date.now();
    await database().batch([
      database().prepare("DELETE FROM quiz_challenges WHERE expires_at<?").bind(now),
      database().prepare("INSERT INTO quiz_challenges(id,auth_id,question_ids,expires_at) VALUES(?,?,?,?)").bind(id,user.id,JSON.stringify(questions.map(q=>q.id)),now+1800000),
    ]);
    return Response.json({id,questions:questions.map(q=>({id:q.id,question:q.question}))});
  });
}
export async function POST(request: Request) {
  return handle(request,async ctx=>{
    const user=await identity(ctx), db=database(), body=await jsonBody(request);
    await rateLimit("quiz-attempt:"+user.id,10);
    const existing=await db.prepare("SELECT id FROM members WHERE auth_id=?").bind(user.id).first();
    if(existing) return Response.json({ok:true});
    const id=text(body.challengeId,80), name=text(body.name,40), challenge=await db.prepare("SELECT * FROM quiz_challenges WHERE id=? AND auth_id=? AND used=0 AND expires_at>?").bind(id,user.id,Date.now()).first<{question_ids:string;attempts:number}>();
    if(!challenge || challenge.attempts>=3) throw new AppError("These questions expired. Request a fresh set.",409);
    await db.prepare("UPDATE quiz_challenges SET attempts=attempts+1 WHERE id=?").bind(id).run();
    const ids: string[]=JSON.parse(challenge.question_ids), values=body.answers as Record<string,unknown>;
    const questions=pool();
    const correct=values && typeof values==="object" && ids.length===3 && ids.every(qid=>{
      const q=questions.find(q=>q.id===qid), value=values[qid];
      return q && typeof value==="string" && value.length<=200 && answerMatches(value,q.answers,q.unordered);
    });
    if(!correct) throw new AppError("Those answers didn't all match. Try again.");
    const email=user.email!.trim().toLowerCase(), role=registrationRole(email,env.ADMIN_EMAIL);
    await db.batch([
      db.prepare("INSERT INTO operation_checks(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM quiz_challenges WHERE id=? AND used=0 AND attempts<=3 AND expires_at>?) THEN 1 ELSE 0 END").bind(id,Date.now()),
      db.prepare("INSERT INTO members(id,auth_id,email,name,role) VALUES(?,?,?,?,?)").bind(user.id,user.id,email,name,role),
      db.prepare("INSERT INTO pp_events(id,kind,actor_id,to_id,amount,reason) VALUES(?,'welcome',?,?,100,'Starting PP')").bind("welcome:"+user.id,user.id,user.id),
      db.prepare("UPDATE quiz_challenges SET used=1 WHERE id=?").bind(id),
      db.prepare("DELETE FROM operation_checks"),
    ]);
    await assignReviews(db).catch(()=>{});
    return Response.json({ok:true},{status:201});
  });
}
