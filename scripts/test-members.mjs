import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import assert from "node:assert/strict";

const output=path.resolve("work/tests");mkdirSync(output,{recursive:true});
for(const name of ["rules","domain"]) {
  const source=readFileSync("lib/"+name+".ts","utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll('from "./rules"','from "./rules.mjs"');
  writeFileSync(path.join(output,name+".mjs"),compiled);
}
const {mutate,assignReviews}=await import(path.join(output,"domain.mjs"));
const {answerMatches,questStake}=await import(path.join(output,"rules.mjs"));
let sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
for(const file of readdirSync("drizzle").filter(x=>x.endsWith(".sql")).sort())sqlite.exec(readFileSync("drizzle/"+file,"utf8"));
class Statement {
  constructor(sql,values=[]){this.sql=sql;this.values=values;}
  bind(...values){return new Statement(this.sql,values);}
  async first(){return sqlite.prepare(this.sql).get(...this.values)||null;}
  async all(){return {results:sqlite.prepare(this.sql).all(...this.values)};}
  async run(){const info=sqlite.prepare(this.sql).run(...this.values);return {success:true,meta:{changes:Number(info.changes)}};}
}
let beforeBatch;
const db={prepare(sql){return new Statement(sql);},async batch(statements){
  const hook=beforeBatch;beforeBatch=undefined;if(hook)await hook();
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    const results=statements.map(s=>{sqlite.prepare(s.sql).run(...s.values);return {results:[],success:true};});
    sqlite.exec("COMMIT");return results;
  }catch(error){sqlite.exec("ROLLBACK");throw error;}
}};
const actors={};for(const id of ["alice","bob","chris","dee","erin","kam"]) {
  actors[id]={id,role:id==="kam"?"admin":"member"};
  sqlite.prepare("INSERT INTO members(id,auth_id,email,name,role) VALUES(?,?,?,?,?)").run(id,id,id+"@example.test",id,actors[id].role);
  sqlite.prepare("INSERT INTO pp_events(id,kind,actor_id,to_id,amount) VALUES(?,'welcome',?,?,100)").run("welcome:"+id,id,id);
}
const get=(sql,...values)=>sqlite.prepare(sql).get(...values);
const rows=(sql,...values)=>sqlite.prepare(sql).all(...values);
const balance=id=>get("SELECT balance FROM members WHERE id=?",id).balance;
let checks=0;
const ok=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const rejects=async(fn,message)=>{await assert.rejects(fn,undefined,message);checks++;};
const doAction=(who,body,key=crypto.randomUUID())=>mutate(db,actors[who],body.op==="commit"&&body.revision==null?{...body,revision:get("SELECT revision FROM quests WHERE id=?",body.questId)?.revision}:body,key);
async function create(who,points=20,other={}) {
  const result=await doAction(who,{op:"create_quest",title:"Synthetic quest",points,...other});
  return get("SELECT * FROM quests WHERE request_key=?",result.requestKey);
}
async function submit(who,q){await doAction(who,{op:"commit",questId:q.id});const result=await doAction(who,{op:"submit",questId:q.id,story:"Synthetic completion"});return result.id;}
async function approve(sid){
  const assigned=rows("SELECT * FROM reviews WHERE submission_id=?",sid);
  ok(assigned.length,2,"Two distinct reviewers");
  for(const r of assigned)await doAction(r.reviewer_id,{op:"review",submissionId:sid,decision:"approve",note:"Witness verified"});
}
ok(questStake(5,35),20);ok(questStake(35,35),35);ok(questStake(-20,10),20);
ok(answerMatches("LUNA & MILO",["Milo and Luna"],true),true);
ok(answerMatches("milo, luna",["Milo and Luna"],true),true);
ok(answerMatches("milo",["Milo and Luna"],true),false);
ok(answerMatches(" random ",["Expected"]),false);
const q=await create("alice",35);ok(balance("alice"),65);
await rejects(()=>doAction("bob",{op:"delete_quest",questId:q.id}),"Ownership");
await rejects(()=>doAction("alice",{op:"commit",questId:q.id}),"No self-pot");
await rejects(()=>doAction("bob",{op:"submit",questId:q.id,story:"No commitment"}));
await rejects(()=>doAction("alice",{op:"create_quest",title:"Bad",points:9}));
await rejects(()=>doAction("alice",{op:"create_quest",title:"Bad",points:36}));
const b=await submit("bob",q), d=await submit("dee",q);
const reviewers=rows("SELECT * FROM reviews WHERE submission_id=?",b);
ok(reviewers.length,2);ok(new Set(reviewers.map(r=>r.reviewer_id)).size,2);
ok(reviewers.every(r=>!["alice","bob"].includes(r.reviewer_id)),true);
await rejects(()=>doAction("alice",{op:"review",submissionId:b,decision:"approve"}));
await rejects(()=>doAction("bob",{op:"review",submissionId:b,decision:"approve"}));
await doAction(reviewers[0].reviewer_id,{op:"review",submissionId:b,decision:"approve"});
ok(balance("bob"),100,"One review must not pay");
await rejects(()=>doAction(reviewers[0].reviewer_id,{op:"review",submissionId:b,decision:"approve"}));
await doAction(reviewers[1].reviewer_id,{op:"review",submissionId:b,decision:"approve"});
ok(balance("bob"),135,"Winner receives exactly one pot");
await approve(d);ok(balance("dee"),100,"Second approved finisher receives no additional pot");
ok(rows("SELECT * FROM pp_events WHERE kind='quest_payout' AND quest_id=?",q.id).length,1);
ok(get("SELECT winner_submission_id FROM quests WHERE id=?",q.id).winner_submission_id,b);
await doAction("erin",{op:"kudos",submissionId:b});
await doAction("erin",{op:"kudos",submissionId:b});
ok(rows("SELECT * FROM kudos WHERE submission_id=?",b).length,1);
await rejects(()=>doAction("bob",{op:"kudos",submissionId:b}));
const tipKey=crypto.randomUUID(),tip={op:"tip",memberId:"alice",amount:10};
await doAction("bob",tip,tipKey);await doAction("bob",tip,tipKey);
ok(balance("bob"),125);ok(balance("alice"),75);
await rejects(()=>doAction("bob",{...tip,amount:11},tipKey));
const tipping=rows("SELECT * FROM pp_events WHERE kind='tip'")[0];
await rejects(()=>doAction("bob",{op:"admin_reverse_event",eventId:tipping.id,reason:"Unauthorized"}));
await doAction("kam",{op:"admin_reverse_event",eventId:tipping.id,reason:"Synthetic reversal"});
ok(balance("bob"),135);ok(balance("alice"),65);
await rejects(()=>doAction("kam",{op:"admin_reverse_event",eventId:tipping.id,reason:"Double reversal"}));
const listing=await doAction("erin",{op:"create_listing",title:"Synthetic reward",description:"Test item",price:25,stock:1});
const purchase=await doAction("bob",{op:"buy",listingId:listing.id,expectedPrice:25,revision:0});ok(balance("bob"),110);
await rejects(()=>doAction("dee",{op:"buy",listingId:listing.id,expectedPrice:25,revision:0}));
ok(balance("dee"),100);
await rejects(()=>doAction("dee",{op:"purchase_received",purchaseId:purchase.id}));
await doAction("erin",{op:"purchase_ready",purchaseId:purchase.id});
await doAction("bob",{op:"purchase_received",purchaseId:purchase.id});
ok(balance("erin"),125);
await rejects(()=>doAction("bob",{op:"purchase_received",purchaseId:purchase.id}));
await doAction("kam",{op:"admin_refund_purchase",purchaseId:purchase.id,reason:"Recovery fixture"});
ok(balance("bob"),135);ok(balance("erin"),100);ok(get("SELECT stock FROM listings WHERE id=?",listing.id).stock,1);
await rejects(()=>doAction("kam",{op:"admin_refund_purchase",purchaseId:purchase.id,reason:"Twice"}));
const p2=await doAction("bob",{op:"buy",listingId:listing.id,expectedPrice:25,revision:0});await doAction("erin",{op:"purchase_cancel",purchaseId:p2.id});
ok(balance("bob"),135);ok(balance("erin"),100);
await doAction("kam",{op:"admin_adjust",memberId:"chris",amount:-95,reason:"Debt setup"});ok(balance("chris"),5);
await create("chris",35);ok(balance("chris"),-15);
await create("chris",10);ok(balance("chris"),-35);
await rejects(()=>doAction("chris",{op:"tip",memberId:"bob",amount:1}));
await rejects(()=>doAction("chris",{op:"buy",listingId:listing.id,expectedPrice:25,revision:0}));
ok(get("SELECT stock FROM listings WHERE id=?",listing.id).stock,1,"Failed debit rolls back stock");
const scheduled=await create("alice",10,{eventAt:new Date(Date.now()+3600000).toISOString()});
await doAction("erin",{op:"commit",questId:scheduled.id});
await rejects(()=>doAction("alice",{op:"report_no_show",questId:scheduled.id,memberId:"erin"}),"No early no-show");
sqlite.prepare("UPDATE quests SET event_at=? WHERE id=?").run(new Date(Date.now()-3600000).toISOString(),scheduled.id);
await rejects(()=>doAction("erin",{op:"leave",questId:scheduled.id}),"No retroactive withdrawal");
await doAction("alice",{op:"report_no_show",questId:scheduled.id,memberId:"erin"});
await rejects(()=>doAction("alice",{op:"admin_no_show",questId:scheduled.id,memberId:"erin",reason:"Unauthorized"}));
await doAction("kam",{op:"admin_no_show",questId:scheduled.id,memberId:"erin",reason:"Confirmed absent"});ok(balance("erin"),90);
await doAction("kam",{op:"admin_reverse_event",eventId:"noshow:"+scheduled.id+":erin",reason:"They attended"});ok(balance("erin"),100);
const archive=await create("alice",10);await doAction("alice",{op:"delete_quest",questId:archive.id});
ok(!!get("SELECT deleted_at FROM quests WHERE id=?",archive.id).deleted_at,true);
await doAction("kam",{op:"admin_restore_quest",questId:archive.id,reason:"Accidental archive"});ok(get("SELECT deleted_at FROM quests WHERE id=?",archive.id).deleted_at,null);
await doAction("kam",{op:"admin_reverse_event",eventId:"payout:"+b,reason:"Incorrect completion"});
ok(balance("bob"),100);ok(get("SELECT status FROM quests WHERE id=?",q.id).status,"open");
const b2=await submit("bob",q);await approve(b2);ok(balance("bob"),135);
await rejects(async()=>{sqlite.prepare("UPDATE pp_events SET amount=1 WHERE id=?").run("payout:"+b2);},"Immutable journal");
// Registration grants are unique even if callers retry enrollment.
await rejects(async()=>{sqlite.prepare("INSERT INTO pp_events(id,kind,actor_id,to_id,amount) VALUES('welcome:bob','welcome','bob','bob',100)").run();});
ok(balance("bob"),135);
ok(rows("SELECT * FROM operation_checks").length,0);
const expected=rows("SELECT m.id,m.balance,COALESCE((SELECT SUM(CASE WHEN e.to_id=m.id THEN e.amount ELSE 0 END)-SUM(CASE WHEN e.from_id=m.id THEN e.amount ELSE 0 END) FROM pp_events e WHERE e.to_id=m.id OR e.from_id=m.id),0) AS journal FROM members m");
ok(expected.every(m=>m.balance===m.journal),true,"Every balance reconciles with immutable events");
const sharedQuest=await create("bob",10);
await doAction("alice",{op:"commit",questId:sharedQuest.id});
const firstStory=await submit("erin",sharedQuest);await approve(firstStory);
const lateStory=await doAction("alice",{op:"submit",questId:sharedQuest.id,story:"Another member finished later"});
await approve(lateStory.id);
ok(rows("SELECT * FROM pp_events WHERE kind='quest_payout' AND quest_id=?",sharedQuest.id).length,1);
ok(get("SELECT status FROM submissions WHERE id=?",lateStory.id).status,"approved");
const refundQuest=await create("alice",10);
const beforeRefund=balance("alice");
await doAction("kam",{op:"admin_reverse_event",eventId:refundQuest.request_key,reason:"Cancelled quest"});
ok(balance("alice"),beforeRefund+10);
ok(get("SELECT status FROM quests WHERE id=?",refundQuest.id).status,"cancelled");
await rejects(()=>doAction("kam",{op:"admin_reverse_event",eventId:refundQuest.request_key,reason:"Duplicate refund"}));
// Owner edits preserve accounting and lock against stale forms / concurrent commitments.
const editable=await create("alice",10), ownerBalance=balance("alice");
const edit={op:"edit_quest",questId:editable.id,revision:0,title:"Updated plan",description:"Meet by the gate",reward:"A story",category:"wander",eventAt:new Date(Date.now()+7200000).toISOString()};
await rejects(()=>doAction("bob",edit),"Another member cannot edit");
await rejects(()=>doAction("kam",edit),"Admin does not impersonate an owner");
await rejects(()=>doAction("alice",{...edit,eventAt:"not a date"}));
await rejects(()=>create("alice",10,{eventAt:"not a date"}));
await doAction("bob",{op:"interested",questId:editable.id});
const editKey=crypto.randomUUID();
await doAction("alice",edit,editKey);await doAction("alice",edit,editKey);
ok({...get("SELECT title,points,revision FROM quests WHERE id=?",editable.id)},{title:"Updated plan",points:10,revision:1});
ok(balance("alice"),ownerBalance,"Editing does not move the stake");
ok(rows("SELECT * FROM audit_events WHERE action='edit_quest' AND target_id=?",String(editable.id)).length,1,"Retry does not duplicate edit");
await rejects(()=>doAction("alice",edit),"Old edit revision rejected");
await rejects(()=>doAction("bob",{op:"commit",questId:editable.id,revision:0}),"Stale commitment rejected");
beforeBatch=()=>doAction("bob",{op:"commit",questId:editable.id,revision:1});
await rejects(()=>doAction("alice",{...edit,revision:1,title:"Changed after commitment"}),"Concurrent commitment locks edit");
ok({...get("SELECT title,revision FROM quests WHERE id=?",editable.id)},{title:"Updated plan",revision:1});
await rejects(()=>doAction("alice",{...edit,revision:1}),"Existing commitment locks edit");
const staleCommitQuest=await create("alice",10);
beforeBatch=()=>doAction("alice",{...edit,questId:staleCommitQuest.id,title:"A different plan"});
await rejects(()=>doAction("bob",{op:"commit",questId:staleCommitQuest.id,revision:0}),"Concurrent edit invalidates old commitment");
ok(rows("SELECT * FROM attendance WHERE quest_id=? AND status='committed'",staleCommitQuest.id).length,0);

// Restocking is additive; purchases keep the agreed price/title even after edits.
const offer=await doAction("erin",{op:"create_listing",title:"Original offer",description:"One original",price:7,stock:2});
const offerEdit={op:"edit_listing",listingId:offer.id,revision:0,title:"Updated offer",description:"New description",price:9,addStock:3};
await rejects(()=>doAction("bob",offerEdit));await rejects(()=>doAction("kam",offerEdit));
await rejects(()=>doAction("erin",{...offerEdit,addStock:-1}));
await rejects(()=>doAction("erin",{...offerEdit,addStock:1.5}));
const bought=await doAction("bob",{op:"buy",listingId:offer.id,expectedPrice:7,revision:0});
const stockKey=crypto.randomUUID();
await doAction("erin",offerEdit,stockKey);await doAction("erin",offerEdit,stockKey);
ok({...get("SELECT stock,price,revision FROM listings WHERE id=?",offer.id)},{stock:4,price:9,revision:1});
ok({...get("SELECT title,price FROM purchases WHERE id=?",bought.id)},{title:"Original offer",price:7});
await rejects(()=>doAction("erin",offerEdit),"Stale restock does not add stock");
const buyerBalance=balance("bob");
await rejects(()=>doAction("bob",{op:"buy",listingId:offer.id,expectedPrice:7,revision:0}));
ok(balance("bob"),buyerBalance);ok(get("SELECT stock FROM listings WHERE id=?",offer.id).stock,4);
await doAction("bob",{op:"purchase_cancel",purchaseId:bought.id});
ok(balance("bob"),buyerBalance+7,"Refund uses agreed original price");
ok(get("SELECT stock FROM listings WHERE id=?",offer.id).stock,5);
beforeBatch=()=>doAction("erin",{...offerEdit,revision:1,price:11,addStock:0});
await rejects(()=>doAction("bob",{op:"buy",listingId:offer.id,expectedPrice:9,revision:1}),"Concurrent price change rolls back checkout");
ok(balance("bob"),buyerBalance+7);ok(get("SELECT stock FROM listings WHERE id=?",offer.id).stock,5);
beforeBatch=()=>doAction("bob",{op:"buy",listingId:offer.id,expectedPrice:11,revision:2});
await doAction("erin",{...offerEdit,revision:2,price:11,addStock:2});
ok({...get("SELECT stock,revision FROM listings WHERE id=?",offer.id)},{stock:6,revision:3},"Concurrent sale is not overwritten by restock");

// Reassign only a pending reviewer; keep approvals and retain exactly two independent peers.
const recoveryQuest=await create("alice",10), recoverySubmission=await submit("bob",recoveryQuest);
const recoveryReviews=rows("SELECT * FROM reviews WHERE submission_id=?",recoverySubmission);
await doAction(recoveryReviews[0].reviewer_id,{op:"review",submissionId:recoverySubmission,decision:"approve"});
const reassign={op:"admin_reassign_review",reviewId:recoveryReviews[1].id,reason:"Reviewer unavailable"};
await rejects(()=>doAction("alice",reassign));
await rejects(()=>doAction("kam",{...reassign,reason:""}));
await rejects(()=>doAction("kam",{...reassign,reviewId:recoveryReviews[0].id}),"Approved reviewer cannot be removed");
const reassignKey=crypto.randomUUID(), replacement=await doAction("kam",reassign,reassignKey);
ok(await doAction("kam",reassign,reassignKey),replacement,"Reassignment retry is idempotent");
ok(rows("SELECT * FROM reviews WHERE submission_id=?",recoverySubmission).length,2);
ok(get("SELECT decision FROM reviews WHERE id=?",recoveryReviews[0].id).decision,"approve");
ok(!["alice","bob",...recoveryReviews.map(r=>r.reviewer_id)].includes(replacement.reviewerId),true);
ok(get("SELECT reason FROM audit_events WHERE action='admin_reassign_review' AND target_id=?",recoverySubmission).reason.includes("Reviewer unavailable"),true);
await rejects(()=>doAction(recoveryReviews[1].reviewer_id,{op:"review",submissionId:recoverySubmission,decision:"approve"}),"Replaced reviewer has no authority");
await doAction(replacement.reviewerId,{op:"review",submissionId:recoverySubmission,decision:"approve"});
ok(get("SELECT status FROM submissions WHERE id=?",recoverySubmission).status,"approved");
const raceReviewQuest=await create("alice",10), raceSubmission=await submit("bob",raceReviewQuest);
const raceReview=rows("SELECT * FROM reviews WHERE submission_id=?",raceSubmission)[0];
beforeBatch=()=>doAction(raceReview.reviewer_id,{op:"review",submissionId:raceSubmission,decision:"approve"});
await rejects(()=>doAction("kam",{...reassign,reviewId:raceReview.id}),"Concurrent approval prevents replacement");
ok(get("SELECT decision FROM reviews WHERE id=?",raceReview.id).decision,"approve");
const noCandidateQuest=await create("kam",10), noCandidateSubmission=await submit("bob",noCandidateQuest);
const noCandidateReviews=rows("SELECT * FROM reviews WHERE submission_id=?",noCandidateSubmission);
sqlite.prepare("UPDATE members SET status='blocked' WHERE id NOT IN(?,?,?,?)").run("kam","bob",...noCandidateReviews.map(r=>r.reviewer_id));
await rejects(()=>doAction("kam",{...reassign,reviewId:noCandidateReviews[0].id}),"No eligible replacement leaves assignment intact");
ok(rows("SELECT * FROM reviews WHERE submission_id=?",noCandidateSubmission).map(r=>r.id).sort(),noCandidateReviews.map(r=>r.id).sort());
sqlite.prepare("UPDATE members SET status='active'").run();
ok(rows("SELECT m.id FROM members m WHERE m.balance<>COALESCE((SELECT SUM(CASE WHEN e.to_id=m.id THEN e.amount ELSE 0 END)-SUM(CASE WHEN e.from_id=m.id THEN e.amount ELSE 0 END) FROM pp_events e WHERE e.to_id=m.id OR e.from_id=m.id),0)").length,0,"All balances still reconcile after recovery and races");
ok(rows("SELECT * FROM operation_checks").length,0);
sqlite.close();
// A tiny group never bypasses the two-reviewer threshold.
sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");for(const f of readdirSync("drizzle").filter(x=>x.endsWith(".sql")).sort())sqlite.exec(readFileSync("drizzle/"+f,"utf8"));
for(const id of ["alice","bob","chris"]) {
  sqlite.prepare("INSERT INTO members(id,auth_id,email,name,role) VALUES(?,?,?,?,?)").run(id,id,id+"@example.test",id,"member");
  sqlite.prepare("INSERT INTO pp_events(id,kind,actor_id,to_id,amount) VALUES(?,'welcome',?,?,100)").run("welcome:"+id,id,id);
}
const tinyQuest=await create("alice"),tinySubmission=await submit("bob",tinyQuest);
ok(rows("SELECT * FROM reviews WHERE submission_id=?",tinySubmission).length,1);
await doAction("chris",{op:"review",submissionId:tinySubmission,decision:"approve"});
ok(balance("bob"),100,"One available peer does not lower threshold");
ok(get("SELECT status FROM submissions WHERE id=?",tinySubmission).status,"pending");
sqlite.prepare("INSERT INTO members(id,auth_id,email,name) VALUES('dee','dee','dee@example.test','dee')").run();
await assignReviews(db);
ok(rows("SELECT * FROM reviews WHERE submission_id=?",tinySubmission).length,2);
await doAction("dee",{op:"review",submissionId:tinySubmission,decision:"approve"});
ok(balance("bob"),120);
await rejects(()=>doAction("bob",{op:"create_quest",title:{bad:true},points:20}));
await rejects(()=>doAction("bob",{op:"tip",memberId:"dee",amount:"10"}));
sqlite.close();
console.log("PASS: "+checks+" domain, permission, accounting, recovery, answer-normalization, and migration checks.");
