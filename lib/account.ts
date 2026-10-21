import { AppError } from "./rules";
import { one, prepare, query, type Query } from "./domain";

export async function accountFingerprint(email:string, secret:string) {
  if(!secret || secret.length<32) throw new AppError("Account deletion is being configured.",503);
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(email.trim().toLowerCase())))).map(x=>x.toString(16).padStart(2,"0")).join("");
}
const check=(sql:string,...params:(string|number)[])=>query("INSERT INTO operation_checks(ok) SELECT CASE WHEN ("+sql+") THEN 1 ELSE 0 END",...params);
const blockers=[
  ["EXISTS(SELECT 1 FROM purchases WHERE (buyer_id=? OR seller_id=?) AND status IN('pending','ready'))","Finish or cancel your pending purchases before deleting your account.",2],
  ["EXISTS(SELECT 1 FROM attendance a JOIN quests q ON q.id=a.quest_id WHERE a.member_id=? AND (a.status='reported' OR (a.status='committed' AND q.event_at IS NOT NULL AND julianday(q.event_at)<=julianday('now'))))","Resolve your scheduled commitments or no-show reports before deleting your account.",1],
  ["EXISTS(SELECT 1 FROM quests q WHERE q.owner_id=? AND (EXISTS(SELECT 1 FROM attendance a WHERE a.quest_id=q.id AND a.member_id<>q.owner_id AND a.status='committed') OR EXISTS(SELECT 1 FROM submissions s WHERE s.quest_id=q.id AND s.member_id<>q.owner_id AND s.status='pending')))","Resolve commitments and pending completions on your quests before deleting your account.",1],
] as const;

// Close only the server-verified caller. A retained tombstone protects shared accounting.
export async function closeAccount(db:D1Database, authId:string, fingerprint:string) {
  if(await one(db,"SELECT auth_id FROM account_deletions WHERE auth_id=?",authId)) return;
  const person=await one(db,"SELECT * FROM members WHERE auth_id=?",authId);
  if(person && person.balance<0) throw new AppError("Settle your negative PP balance before deleting your account.",409);
  if(person) for(const [sql,message,count] of blockers) if(await one(db,"SELECT 1 WHERE "+sql,...Array(count).fill(person.id))) throw new AppError(message,409);
  const statements:Query[]=[query("INSERT INTO account_deletions(auth_id) VALUES(?)",authId)];
  if(person) {
    statements.push(check("EXISTS(SELECT 1 FROM members WHERE id=? AND auth_id=? AND status<>'deleted' AND balance>=0)",person.id,authId));
    for(const [sql,,count] of blockers) statements.push(check("NOT ("+sql+")",...Array(count).fill(person.id)));
    statements.push(query("INSERT OR IGNORE INTO welcome_claims(fingerprint) VALUES(?)",fingerprint));
    statements.push(query("UPDATE members SET status='deleted',role='member',name='Deleted member',email=?,auth_id=? WHERE id=?","deleted:"+person.id,"deleted:"+person.id,person.id));
    statements.push(query("INSERT INTO pp_events(id,kind,actor_id,to_id,amount,quest_id,reason) SELECT 'account-pot:'||id,'account_quest_refund',?,owner_id,points,id,'Quest cancelled on account deletion' FROM quests WHERE owner_id=? AND funded=1 AND winner_submission_id IS NULL",person.id,person.id));
    statements.push(query("UPDATE quests SET created_by='Deleted member',funded=CASE WHEN winner_submission_id IS NULL THEN 0 ELSE funded END,deleted_at=COALESCE(deleted_at,CURRENT_TIMESTAMP),revision=revision+1 WHERE owner_id=?",person.id));
    statements.push(query("UPDATE listings SET deleted_at=COALESCE(deleted_at,CURRENT_TIMESTAMP),revision=revision+1 WHERE owner_id=?",person.id));
    statements.push(query("UPDATE submissions SET status='withdrawn',decided_at=CURRENT_TIMESTAMP WHERE member_id=? AND status='pending'",person.id));
    statements.push(query("DELETE FROM reviews WHERE decision='pending' AND (reviewer_id=? OR submission_id IN(SELECT id FROM submissions WHERE member_id=? AND status='withdrawn'))",person.id,person.id));
    statements.push(query("UPDATE attendance SET status='left' WHERE member_id=? AND status IN('interested','committed')",person.id));
    // Chunk large balances so every compensating event obeys the journal's 100,000 PP cap.
    statements.push(query("WITH RECURSIVE chunks(n,remaining) AS (SELECT 0,balance FROM members WHERE id=? AND balance>0 UNION ALL SELECT n+1,remaining-100000 FROM chunks WHERE remaining>100000) INSERT INTO pp_events(id,kind,actor_id,from_id,amount,reason) SELECT 'account-retire:'||?||':'||n,'account_retirement',?,?,MIN(remaining,100000),'Unspent PP retired on account deletion' FROM chunks",person.id,person.id,person.id,person.id));
    statements.push(check("EXISTS(SELECT 1 FROM members WHERE id=? AND balance=0)",person.id));
    statements.push(query("INSERT INTO audit_events(id,actor_id,action,target_id,reason) VALUES(?,?,'delete_account',?,'Member requested account deletion; shared history retained anonymously')",crypto.randomUUID(),person.id,person.id));
    statements.push(query("DELETE FROM commands WHERE actor_id=?",person.id));
  }
  statements.push(query("DELETE FROM quiz_challenges WHERE auth_id=?",authId),query("DELETE FROM operation_checks"));
  try {await db.batch(statements.map(q=>prepare(db,q)));}
  catch(error) {if(!await one(db,"SELECT auth_id FROM account_deletions WHERE auth_id=?",authId)) throw error;}
}
