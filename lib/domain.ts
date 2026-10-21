import { AppError, text, integer, shuffled } from "./rules";
export type Actor = { id: string; role: string };
export type Row = Record<string, any>;
export type Query = { sql: string; params?: (string | number | null)[] };
export const query = (sql: string, ...params: (string | number | null)[]): Query => ({sql,params});
export const prepare = (db: D1Database, q: Query) => db.prepare(q.sql).bind(...(q.params || []));
export async function one(db: D1Database, sql: string, ...params: (string|number|null)[]) { return db.prepare(sql).bind(...params).first<Row>(); }
export async function many(db: D1Database, sql: string, ...params: (string|number|null)[]) { return (await db.prepare(sql).bind(...params).all<Row>()).results; }
const check = (condition: string, ...params: (string|number|null)[]) => query("INSERT INTO operation_checks(ok) SELECT CASE WHEN ("+condition+") THEN 1 ELSE 0 END",...params);
const event = (id: string, kind: string, actor: Actor, from: string|null, to: string|null, amount: number, quest: number|null = null, purchase: string|null = null, reason = "", reverses: string|null = null) =>
  query("INSERT INTO pp_events(id,kind,actor_id,from_id,to_id,amount,quest_id,purchase_id,reason,reverses_id) VALUES(?,?,?,?,?,?,?,?,?,?)",id,kind,actor.id,from,to,amount,quest,purchase,reason,reverses);
const audit = (actor: Actor, action: string, target: string, reason: string) => query("INSERT INTO audit_events(id,actor_id,action,target_id,reason) VALUES(?,?,?,?,?)",crypto.randomUUID(),actor.id,action,target,reason);
function mustAdmin(actor: Actor) { if(actor.role !== "admin") throw new AppError("Only Kamrul can use this action.",403); }
function uuid(value: unknown) { const id = text(value,80); if(!/^[a-zA-Z0-9:_-]+$/.test(id)) throw new AppError("Invalid identifier."); return id; }
function optional(value: unknown, length: number) { return value == null || value === "" ? "" : text(value,length,false); }
const categories = new Set(["move","make","wander","connect","learn","misc"]);
function eventTime(value: unknown): string|null {
  if(value == null || value === "") return null;
  const timestamp=Date.parse(text(value,40));
  if(!Number.isFinite(timestamp) || timestamp<=Date.now()) throw new AppError("Choose a future time.");
  return new Date(timestamp).toISOString();
}
export async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,"0")).join(""); }
async function commit(db: D1Database, actor: Actor, key: string, body: Row, statements: Query[], response: Row) {
  const commandId = actor.id+":"+key, hash = await digest(JSON.stringify(body));
  const existing = await one(db,"SELECT * FROM commands WHERE id=?",commandId);
  if(existing) { if(existing.digest!==hash) throw new AppError("That request was already used.",409); return JSON.parse(existing.response); }
  try {
    await db.batch([
      prepare(db,query("INSERT INTO commands(id,actor_id,digest,response) VALUES(?,?,?,?)",commandId,actor.id,hash,JSON.stringify(response))),
      ...statements.map(q=>prepare(db,q)),
      db.prepare("DELETE FROM operation_checks"),
    ]);
  } catch(error) {
    const concurrent = await one(db,"SELECT * FROM commands WHERE id=?",commandId);
    if(concurrent?.digest===hash) return JSON.parse(concurrent.response);
    throw error;
  }
  return response;
}
export async function assignReviews(db: D1Database, submissionId?: string) {
  const pending = await many(db,"SELECT s.*,q.owner_id FROM submissions s JOIN quests q ON q.id=s.quest_id WHERE s.status='pending' AND q.deleted_at IS NULL AND (SELECT COUNT(*) FROM reviews r WHERE r.submission_id=s.id)<2"+(submissionId?" AND s.id=?":"")+" LIMIT 100",...(submissionId?[submissionId]:[]));
  for(const s of pending) {
    const eligible = shuffled(await many(db,"SELECT id FROM members WHERE status='active' AND id<>? AND id<>COALESCE(?,'') AND id NOT IN(SELECT reviewer_id FROM reviews WHERE submission_id=?)",s.member_id,s.owner_id,s.id));
    const statements = eligible.slice(0,2).map(person=>prepare(db,query("INSERT OR IGNORE INTO reviews(id,submission_id,reviewer_id) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM reviews WHERE submission_id=?)<2",crypto.randomUUID(),s.id,person.id,s.id)));
    if(statements.length) await db.batch(statements);
  }
}
export async function mutate(db: D1Database, actor: Actor, body: Row, key: string) {
  if(!/^[a-f0-9-]{36}$/i.test(key)) throw new AppError("Missing request identifier.");
  if(!await one(db,"SELECT id FROM members WHERE id=? AND status='active'",actor.id)) throw new AppError("Membership required.",403);
  const op = text(body.op,40), id = crypto.randomUUID(), statements: Query[] = [];
  let response: Row = {ok:true};
  // Resolve successful retries before state-dependent validation.
  const previous = await one(db,"SELECT digest,response FROM commands WHERE id=?",actor.id+":"+key);
  if(previous) { if(previous.digest!==await digest(JSON.stringify(body))) throw new AppError("That request was already used.",409); return JSON.parse(previous.response); }
  if(op==="create_quest") {
    const title=text(body.title,100), description=optional(body.description,2000), reward=optional(body.reward,200), points=integer(body.points,10,35);
    const category=categories.has(body.category)?body.category:"misc";
    const eventAt=eventTime(body.eventAt);
    statements.push(query("INSERT INTO quests(title,description,reward,points,category,owner_id,created_by,funded,event_at,request_key) SELECT ?,?,?,CASE WHEN balance>=? THEN ? ELSE 20 END,?,id,name,1,?,? FROM members WHERE id=?",title,description,reward,points,points,category,eventAt,id,actor.id));
    statements.push(query("INSERT INTO pp_events(id,kind,actor_id,from_id,amount,quest_id,reason) SELECT ?,'quest_stake',?,owner_id,points,id,'Quest pot' FROM quests WHERE request_key=?",id,actor.id,id));
    statements.push(check("EXISTS(SELECT 1 FROM pp_events WHERE id=?)",id));
    response={ok:true,requestKey:id};
  } else if(op==="edit_quest") {
    const questId=integer(body.questId), revision=integer(body.revision,0,2147483646);
    const q=await one(db,"SELECT * FROM quests WHERE id=? AND deleted_at IS NULL",questId);
    if(!q) throw new AppError("Quest not found.",404);
    if(q.owner_id!==actor.id) throw new AppError("Only the quest owner can edit its details.",403);
    if(q.revision!==revision) throw new AppError("This quest changed. Close the form and review its current details.",409);
    const title=text(body.title,100), description=optional(body.description,2000), reward=optional(body.reward,200);
    const category=categories.has(body.category)?body.category:"misc", eventAt=eventTime(body.eventAt);
    // Lock the actual row in the same transaction as the edit. The stake never changes.
    statements.push(check("EXISTS(SELECT 1 FROM quests WHERE id=? AND owner_id=? AND revision=? AND status='open' AND deleted_at IS NULL) AND NOT EXISTS(SELECT 1 FROM attendance WHERE quest_id=? AND status IN('committed','reported','no_show','attended')) AND NOT EXISTS(SELECT 1 FROM submissions WHERE quest_id=?) AND NOT EXISTS(SELECT 1 FROM quest_participants WHERE quest_id=?)",questId,actor.id,revision,questId,questId,questId));
    statements.push(query("UPDATE quests SET title=?,description=?,reward=?,category=?,event_at=?,revision=revision+1 WHERE id=?",title,description,reward,category,eventAt,questId));
    statements.push(audit(actor,op,String(questId),"Owner updated details before commitment; stake unchanged"));
  } else if(["interested","commit","leave","report_no_show"].includes(op)) {
    const questId=integer(body.questId);
    const q=await one(db,"SELECT * FROM quests WHERE id=? AND deleted_at IS NULL",questId);
    if(!q) throw new AppError("Quest not found.",404);
    if(op==="report_no_show") {
      const target=uuid(body.memberId);
      if(q.owner_id!==actor.id && actor.role!=="admin") throw new AppError("Only the organizer can report a no-show.",403);
      if(!q.event_at || Date.parse(q.event_at)>Date.now()) throw new AppError("No-shows can only be reported after the scheduled time.");
      statements.push(query("UPDATE attendance SET status='reported' WHERE quest_id=? AND member_id=? AND status='committed'",questId,target));
      statements.push(check("EXISTS(SELECT 1 FROM attendance WHERE quest_id=? AND member_id=? AND status='reported')",questId,target));
      statements.push(audit(actor,"report_no_show",questId+":"+target,optional(body.reason,400)));
    } else {
      if(q.status!=="open") throw new AppError("This quest is closed.",409);
      if(op==="commit") {
        const revision=integer(body.revision,0,2147483646);
        if(q.revision!==revision) throw new AppError("This quest changed. Review the current details before committing.",409);
        statements.push(check("EXISTS(SELECT 1 FROM quests WHERE id=? AND revision=?)",questId,revision));
      }
      if(op==="commit" && q.owner_id===actor.id) throw new AppError("You can join your outing as interested, but cannot win your own pot.");
      const status=op==="commit"?"committed":op==="interested"?"interested":"left";
      statements.push(check("EXISTS(SELECT 1 FROM quests WHERE id=? AND status='open' AND deleted_at IS NULL)",questId));
      // A commitment cannot be silently withdrawn after the event starts.
      statements.push(check("NOT EXISTS(SELECT 1 FROM attendance a JOIN quests q ON q.id=a.quest_id WHERE a.quest_id=? AND a.member_id=? AND a.status IN('reported','no_show'))",questId,actor.id));
      if(status!=="committed") statements.push(check("NOT EXISTS(SELECT 1 FROM attendance a JOIN quests q ON q.id=a.quest_id WHERE a.quest_id=? AND a.member_id=? AND a.status='committed' AND q.event_at IS NOT NULL AND julianday(q.event_at)<=julianday('now'))",questId,actor.id));
      statements.push(query("INSERT INTO attendance(id,quest_id,member_id,status) VALUES(?,?,?,?) ON CONFLICT(quest_id,member_id) DO UPDATE SET status=excluded.status",id,questId,actor.id,status));
    }
  } else if(op==="submit") {
    const questId=integer(body.questId), story=text(body.story,2000), assetId=body.assetId?uuid(body.assetId):null;
    const q=await one(db,"SELECT * FROM quests WHERE id=? AND deleted_at IS NULL",questId);
    if(!q) throw new AppError("Quest not found.",404);
    if(q.owner_id===actor.id) throw new AppError("You cannot win your own quest pot.",403);
    statements.push(check("EXISTS(SELECT 1 FROM quests q JOIN attendance a ON a.quest_id=q.id WHERE q.id=? AND q.status IN('open','completed') AND q.deleted_at IS NULL AND a.member_id=? AND a.status='committed')",questId,actor.id));
    statements.push(check("NOT EXISTS(SELECT 1 FROM submissions WHERE quest_id=? AND member_id=? AND status IN('pending','approved'))",questId,actor.id));
    if(assetId) statements.push(check("EXISTS(SELECT 1 FROM assets WHERE id=? AND owner_id=? AND status='ready')",assetId,actor.id));
    statements.push(query("INSERT INTO submissions(id,quest_id,member_id,story,asset_id) VALUES(?,?,?,?,?)",id,questId,actor.id,story,assetId));
    response={ok:true,id};
  } else if(op==="review") {
    const submissionId=uuid(body.submissionId), decision=body.decision;
    if(!["approve","reject"].includes(decision)) throw new AppError("Choose approve or request changes.");
    const note=optional(body.note,500);
    if(decision==="reject" && !note) throw new AppError("Explain what needs to change.");
    statements.push(check("EXISTS(SELECT 1 FROM reviews r JOIN submissions s ON s.id=r.submission_id JOIN quests q ON q.id=s.quest_id WHERE r.submission_id=? AND r.reviewer_id=? AND r.decision='pending' AND s.status='pending' AND s.member_id<>? AND COALESCE(q.owner_id,'')<>? AND q.deleted_at IS NULL)",submissionId,actor.id,actor.id,actor.id));
    statements.push(query("UPDATE reviews SET decision=?,note=?,decided_at=CURRENT_TIMESTAMP WHERE submission_id=? AND reviewer_id=? AND decision='pending'",decision,note,submissionId,actor.id));
    statements.push(query("UPDATE submissions SET status=CASE WHEN EXISTS(SELECT 1 FROM reviews WHERE submission_id=? AND decision='reject') THEN 'rejected' ELSE 'approved' END,decided_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND (EXISTS(SELECT 1 FROM reviews WHERE submission_id=? AND decision='reject') OR (SELECT COUNT(*) FROM reviews WHERE submission_id=? AND decision='approve')=2)",submissionId,submissionId,submissionId,submissionId));
    statements.push(query("UPDATE quests SET winner_submission_id=?,status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=(SELECT quest_id FROM submissions WHERE id=? AND status='approved') AND winner_submission_id IS NULL AND status='open' AND deleted_at IS NULL",submissionId,submissionId));
    statements.push(query("INSERT OR IGNORE INTO pp_events(id,kind,actor_id,to_id,amount,quest_id,reason) SELECT ?,'quest_payout',?,s.member_id,q.points,q.id,'First verified finisher' FROM submissions s JOIN quests q ON q.id=s.quest_id WHERE s.id=? AND q.winner_submission_id=s.id AND q.funded=1","payout:"+submissionId,actor.id,submissionId));
    statements.push(query("UPDATE attendance SET status='attended' WHERE quest_id=(SELECT quest_id FROM submissions WHERE id=? AND status='approved') AND member_id=(SELECT member_id FROM submissions WHERE id=?)",submissionId,submissionId));
  } else if(op==="kudos") {
    const submissionId=uuid(body.submissionId);
    statements.push(check("EXISTS(SELECT 1 FROM submissions s JOIN quests q ON q.id=s.quest_id WHERE s.id=? AND s.status='approved' AND s.member_id<>? AND q.deleted_at IS NULL)",submissionId,actor.id));
    statements.push(query("INSERT OR IGNORE INTO kudos(id,submission_id,member_id) VALUES(?,?,?)",id,submissionId,actor.id));
  } else if(op==="tip") {
    const target=uuid(body.memberId), amount=integer(body.amount,1,10000);
    if(target===actor.id) throw new AppError("Choose someone else to tip.");
    statements.push(check("EXISTS(SELECT 1 FROM members WHERE id=? AND status='active')",target));
    statements.push(event(id,"tip",actor,actor.id,target,amount,null,null,optional(body.note,200)));
  } else if(op==="create_listing") {
    const title=text(body.title,100), description=text(body.description,2000), price=integer(body.price), stock=integer(body.stock,1,100), assetId=body.assetId?uuid(body.assetId):null;
    if(assetId) statements.push(check("EXISTS(SELECT 1 FROM assets WHERE id=? AND owner_id=? AND status='ready')",assetId,actor.id));
    statements.push(query("INSERT INTO listings(id,owner_id,title,description,price,stock,asset_id) VALUES(?,?,?,?,?,?,?)",id,actor.id,title,description,price,stock,assetId)); response={ok:true,id};
  } else if(op==="edit_listing") {
    const listingId=uuid(body.listingId), revision=integer(body.revision,0,2147483646);
    const item=await one(db,"SELECT * FROM listings WHERE id=? AND deleted_at IS NULL",listingId);
    if(!item) throw new AppError("Listing not found.",404);
    if(item.owner_id!==actor.id) throw new AppError("Only the listing owner can edit it.",403);
    if(item.revision!==revision) throw new AppError("This listing changed. Close the form and review the current offer.",409);
    const title=text(body.title,100), description=text(body.description,2000), price=integer(body.price), addStock=integer(body.addStock ?? 0,0,100);
    statements.push(check("EXISTS(SELECT 1 FROM listings WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL AND stock+?<=100000)",listingId,actor.id,revision,addStock));
    statements.push(query("UPDATE listings SET title=?,description=?,price=?,stock=stock+?,revision=revision+1 WHERE id=?",title,description,price,addStock,listingId));
    statements.push(audit(actor,op,listingId,"Owner updated listing; added "+addStock+" available units; existing purchases unchanged"));
  } else if(op==="buy") {
    const listingId=uuid(body.listingId), item=await one(db,"SELECT * FROM listings WHERE id=? AND deleted_at IS NULL",listingId);
    if(!item) throw new AppError("Listing not found.",404);
    if(item.owner_id===actor.id) throw new AppError("You cannot buy your own listing.");
    const expectedPrice=integer(body.expectedPrice), revision=integer(body.revision,0,2147483646);
    if(item.price!==expectedPrice || item.revision!==revision) throw new AppError("This listing changed. Close this dialog and review the current offer.",409);
    statements.push(query("INSERT INTO purchases(id,listing_id,buyer_id,seller_id,title,price) SELECT ?,id,?,owner_id,title,price FROM listings WHERE id=? AND stock>0 AND deleted_at IS NULL AND price=? AND revision=?",id,actor.id,listingId,expectedPrice,revision));
    statements.push(check("EXISTS(SELECT 1 FROM purchases WHERE id=?)",id));
    statements.push(query("UPDATE listings SET stock=stock-1 WHERE id=?",listingId));
    statements.push(event(id,"purchase_hold",actor,actor.id,null,item.price,null,id,"Purchase reserved"));
    // A concurrent edit must not change the price between snapshot and reservation.
    statements.push(check("EXISTS(SELECT 1 FROM purchases WHERE id=? AND price=?)",id,item.price));
    response={ok:true,id};
  } else if(["purchase_ready","purchase_received","purchase_cancel"].includes(op)) {
    const purchaseId=uuid(body.purchaseId), p=await one(db,"SELECT * FROM purchases WHERE id=?",purchaseId);
    if(!p) throw new AppError("Purchase not found.",404);
    if(op==="purchase_ready") {
      if(p.seller_id!==actor.id) throw new AppError("Only the seller can mark it ready.",403);
      statements.push(check("EXISTS(SELECT 1 FROM purchases WHERE id=? AND status='pending')",purchaseId));
      statements.push(query("UPDATE purchases SET status='ready' WHERE id=?",purchaseId));
    } else if(op==="purchase_received") {
      if(p.buyer_id!==actor.id) throw new AppError("Only the buyer can confirm receipt.",403);
      statements.push(check("EXISTS(SELECT 1 FROM purchases WHERE id=? AND status IN('pending','ready'))",purchaseId));
      statements.push(event("release:"+purchaseId,"purchase_release",actor,null,p.seller_id,p.price,null,purchaseId,"Buyer confirmed receipt"));
      statements.push(query("UPDATE purchases SET status='fulfilled' WHERE id=?",purchaseId));
    } else {
      if(![p.buyer_id,p.seller_id].includes(actor.id)) throw new AppError("This is someone else's purchase.",403);
      statements.push(check("EXISTS(SELECT 1 FROM purchases WHERE id=? AND status IN('pending','ready'))",purchaseId));
      statements.push(event("refund:"+purchaseId,"purchase_refund",actor,null,p.buyer_id,p.price,null,purchaseId,"Purchase cancelled"));
      statements.push(query("UPDATE purchases SET status='refunded' WHERE id=?",purchaseId));
      statements.push(query("UPDATE listings SET stock=stock+1 WHERE id=?",p.listing_id));
    }
  } else if(op==="delete_quest" || op==="delete_listing") {
    const isQuest=op==="delete_quest", target=isQuest?integer(body.questId):uuid(body.listingId), table=isQuest?"quests":"listings";
    const row=await one(db,"SELECT * FROM "+table+" WHERE id=?",target);
    if(!row) throw new AppError("Not found.",404);
    if(row.owner_id!==actor.id && actor.role!=="admin") throw new AppError("Only the owner can remove this.",403);
    if(isQuest && await one(db,"SELECT id FROM submissions WHERE quest_id=? AND status='pending'",target)) throw new AppError("Finish pending reviews before archiving this quest.");
    statements.push(query("UPDATE "+table+" SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL",target));
    statements.push(audit(actor,op,String(target),"Soft deleted; recoverable by admin"));
  } else if(op==="rename") {
    statements.push(query("UPDATE members SET name=? WHERE id=?",text(body.name,40),actor.id));
  } else if(op.startsWith("admin_")) {
    mustAdmin(actor);
    const reason=text(body.reason,500);
    let auditTarget=String(body.questId||body.memberId||body.purchaseId||body.eventId||"reviews"), auditReason=reason;
    if(op==="admin_restore_quest" || op==="admin_restore_listing") {
      const isQuest=op==="admin_restore_quest", target=isQuest?integer(body.questId):uuid(body.listingId);
      statements.push(query("UPDATE "+(isQuest?"quests":"listings")+" SET deleted_at=NULL WHERE id=?",target));
      statements.push(audit(actor,op,String(target),reason));
    } else if(op==="admin_no_show") {
      const questId=integer(body.questId), target=uuid(body.memberId);
      statements.push(check("EXISTS(SELECT 1 FROM attendance a JOIN quests q ON q.id=a.quest_id WHERE a.quest_id=? AND a.member_id=? AND a.status IN('committed','reported') AND q.event_at IS NOT NULL AND julianday(q.event_at)<=julianday('now'))",questId,target));
      statements.push(event("noshow:"+questId+":"+target,"no_show",actor,target,null,10,questId,null,reason));
      statements.push(query("UPDATE attendance SET status='no_show' WHERE quest_id=? AND member_id=?",questId,target));
    } else if(op==="admin_dismiss_no_show") {
      const questId=integer(body.questId), target=uuid(body.memberId);
      statements.push(check("EXISTS(SELECT 1 FROM attendance WHERE quest_id=? AND member_id=? AND status='reported')",questId,target));
      statements.push(query("UPDATE attendance SET status='attended' WHERE quest_id=? AND member_id=?",questId,target));
    } else if(op==="admin_reverse_event") {
      const target=uuid(body.eventId), original=await one(db,"SELECT * FROM pp_events WHERE id=?",target);
      if(!original || !["tip","no_show","quest_payout","quest_stake"].includes(original.kind)) throw new AppError("This event needs a specific recovery action.");
      statements.push(check("NOT EXISTS(SELECT 1 FROM pp_events WHERE reverses_id=?)",target));
      if(original.kind==="quest_stake") {
        statements.push(check("EXISTS(SELECT 1 FROM quests WHERE id=? AND winner_submission_id IS NULL AND funded=1)",original.quest_id));
        statements.push(check("NOT EXISTS(SELECT 1 FROM submissions WHERE quest_id=? AND status='pending')",original.quest_id));
        statements.push(query("UPDATE quests SET status='cancelled',funded=0 WHERE id=?",original.quest_id));
      }
      if(original.kind==="quest_payout") {
        const sid=target.slice("payout:".length);
        statements.push(check("EXISTS(SELECT 1 FROM quests WHERE id=? AND winner_submission_id=?)",original.quest_id,sid));
        statements.push(query("UPDATE quests SET winner_submission_id=NULL,status='open',completed_at=NULL WHERE id=?",original.quest_id));
        statements.push(query("UPDATE submissions SET status='reversed' WHERE id=?",sid));
        statements.push(query("UPDATE attendance SET status='committed' WHERE quest_id=? AND member_id=?",original.quest_id,original.to_id));
      }
      if(original.kind==="no_show") statements.push(query("UPDATE attendance SET status='attended' WHERE quest_id=? AND member_id=?",original.quest_id,original.from_id));
      statements.push(event("reverse:"+target,"admin_reversal",actor,original.to_id,original.from_id,original.amount,original.quest_id,original.purchase_id,reason,target));
    } else if(op==="admin_refund_purchase") {
      const purchaseId=uuid(body.purchaseId), p=await one(db,"SELECT * FROM purchases WHERE id=?",purchaseId);
      if(!p || p.status==="refunded") throw new AppError("Purchase already refunded or unavailable.",409);
      statements.push(check("EXISTS(SELECT 1 FROM purchases WHERE id=? AND status=?)",purchaseId,p.status));
      statements.push(event("refund:"+purchaseId,"admin_refund",actor,p.status==="fulfilled"?p.seller_id:null,p.buyer_id,p.price,null,purchaseId,reason,p.status==="fulfilled"?"release:"+purchaseId:null));
      statements.push(query("UPDATE purchases SET status='refunded' WHERE id=?",purchaseId));
      statements.push(query("UPDATE listings SET stock=stock+1 WHERE id=?",p.listing_id));
    } else if(op==="admin_adjust") {
      if(typeof body.amount!=="number") throw new AppError("Enter a whole PP amount.");
      const target=uuid(body.memberId), amount=integer(Math.abs(body.amount),1,10000);
      if(!await one(db,"SELECT id FROM members WHERE id=?",target)) throw new AppError("Member not found.",404);
      statements.push(event(id,"admin_adjustment",actor,body.amount<0?target:null,body.amount>0?target:null,amount,null,null,reason));
    } else if(op==="admin_assign_legacy") {
      const questId=integer(body.questId), target=uuid(body.memberId);
      statements.push(check("EXISTS(SELECT 1 FROM members WHERE id=? AND status='active')",target));
      statements.push(check("EXISTS(SELECT 1 FROM quests WHERE id=? AND owner_id IS NULL)",questId));
      statements.push(query("UPDATE quests SET owner_id=? WHERE id=?",target,questId));
    } else if(op==="admin_reassign_review") {
      const reviewId=uuid(body.reviewId);
      const review=await one(db,"SELECT r.*,s.member_id,s.status AS submission_status,q.owner_id,q.deleted_at,m.name AS reviewer_name FROM reviews r JOIN submissions s ON s.id=r.submission_id JOIN quests q ON q.id=s.quest_id JOIN members m ON m.id=r.reviewer_id WHERE r.id=?",reviewId);
      if(!review || review.decision!=="pending" || review.submission_status!=="pending" || review.deleted_at) throw new AppError("Only a pending reviewer assignment can be replaced.",409);
      const candidates=shuffled(await many(db,"SELECT id,name FROM members WHERE status='active' AND id<>? AND id<>COALESCE(?,'') AND id<>? AND id NOT IN(SELECT reviewer_id FROM reviews WHERE submission_id=?)",review.member_id,review.owner_id,review.reviewer_id,review.submission_id));
      const replacement=candidates[0];
      if(!replacement) throw new AppError("No other eligible reviewer is available. The current assignment stays in place.",409);
      statements.push(check("EXISTS(SELECT 1 FROM reviews r JOIN submissions s ON s.id=r.submission_id JOIN quests q ON q.id=s.quest_id WHERE r.id=? AND r.reviewer_id=? AND r.decision='pending' AND s.status='pending' AND q.deleted_at IS NULL)",reviewId,review.reviewer_id));
      statements.push(check("EXISTS(SELECT 1 FROM members m JOIN submissions s ON s.id=? JOIN quests q ON q.id=s.quest_id WHERE m.id=? AND m.status='active' AND m.id<>s.member_id AND m.id<>COALESCE(q.owner_id,'') AND NOT EXISTS(SELECT 1 FROM reviews r WHERE r.submission_id=s.id AND r.reviewer_id=m.id))",review.submission_id,replacement.id));
      statements.push(query("DELETE FROM reviews WHERE id=? AND decision='pending'",reviewId));
      statements.push(query("INSERT INTO reviews(id,submission_id,reviewer_id) VALUES(?,?,?)",id,review.submission_id,replacement.id));
      auditTarget=review.submission_id; auditReason=reason+" · "+review.reviewer_name+" ("+review.reviewer_id+") → "+replacement.name+" ("+replacement.id+"); replaced assignment "+reviewId;
      response={ok:true,id,reviewerId:replacement.id};
    } else if(op==="admin_assign_reviews") {
      await assignReviews(db);
    } else { throw new AppError("Unknown admin action."); }
    statements.push(audit(actor,op,auditTarget,auditReason));
  } else { throw new AppError("Unknown action."); }
  const result=await commit(db,actor,key,body,statements,response);
  if(op==="submit") await assignReviews(db,response.id).catch(()=>{});
  return result;
}
