import { DatabaseSync } from 'node:sqlite';
import { readFileSync,writeFileSync,mkdirSync,readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { deleteLedgerAccount } from '../supabase/functions/delete-ledger-account/handler.mjs';

const output=path.resolve('work/account-tests');mkdirSync(output,{recursive:true});
for(const name of ['rules','domain','account']) {
  const compiled=ts.transpileModule(readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll('from "./rules"','from "./rules.mjs"').replaceAll('from "./domain"','from "./domain.mjs"');
  writeFileSync(path.join(output,name+'.mjs'),compiled);
}
const {closeAccount,accountFingerprint}=await import(path.join(output,'account.mjs'));
const {mutate,assignReviews}=await import(path.join(output,'domain.mjs'));
let sqlite,beforeBatch,checks=0;
class Statement {
  constructor(sql,values=[]){this.sql=sql;this.values=values;}
  bind(...values){return new Statement(this.sql,values);}
  async first(){return sqlite.prepare(this.sql).get(...this.values)||null;}
  async all(){return {results:sqlite.prepare(this.sql).all(...this.values)};}
  async run(){const info=sqlite.prepare(this.sql).run(...this.values);return {success:true,meta:{changes:Number(info.changes)}};}
}
const db={prepare:sql=>new Statement(sql),async batch(statements){
  const hook=beforeBatch;beforeBatch=undefined;if(hook)await hook();
  sqlite.exec('BEGIN IMMEDIATE');
  try{const results=statements.map(s=>{sqlite.prepare(s.sql).run(...s.values);return {results:[],success:true};});sqlite.exec('COMMIT');return results;}
  catch(error){sqlite.exec('ROLLBACK');throw error;}
}};
const get=(sql,...values)=>sqlite.prepare(sql).get(...values);
const rows=(sql,...values)=>sqlite.prepare(sql).all(...values);
const run=(sql,...values)=>sqlite.prepare(sql).run(...values);
const ok=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const rejects=async fn=>{await assert.rejects(fn);checks++;};
const secret='synthetic-test-key-which-is-not-a-production-secret';
const fingerprint=await accountFingerprint('ALICE@example.test ',secret);
ok(fingerprint,await accountFingerprint('alice@example.test',secret),'Normalized email is stable');
assert.notEqual(fingerprint,await accountFingerprint('bob@example.test',secret));checks++;
await rejects(()=>accountFingerprint('a@example.test',''));
function add(id){run('INSERT INTO members(id,auth_id,email,name) VALUES(?,?,?,?)',id,id,id+'@example.test',id);run("INSERT INTO pp_events(id,kind,actor_id,to_id,amount) VALUES(?,'welcome',?,?,100)",'welcome:'+id,id,id);}
function reset(){sqlite?.close();sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+f,'utf8'));for(const id of ['alice','bob','chris','dee','erin'])add(id);}
const action=(id,body)=>mutate(db,{id,role:'member'},body,crypto.randomUUID());
async function quest(id='alice',other={}){const result=await action(id,{op:'create_quest',title:'Test quest',points:20,...other});return get('SELECT * FROM quests WHERE request_key=?',result.requestKey);}
const close=(id='alice')=>closeAccount(db,id,id==='alice'?fingerprint:id+'-fingerprint');
function reconciles(){ok(rows('SELECT m.id FROM members m WHERE m.balance<>COALESCE((SELECT SUM(CASE WHEN e.to_id=m.id THEN e.amount ELSE 0 END)-SUM(CASE WHEN e.from_id=m.id THEN e.amount ELSE 0 END) FROM pp_events e WHERE e.to_id=m.id OR e.from_id=m.id),0)').length,0,'Every wallet reconciles');}

reset();const q=await quest();const listing=await action('alice',{op:'create_listing',title:'Gift',description:'Gift description',price:5,stock:1});
await close();
ok({...get('SELECT name,email,auth_id,role,status,balance FROM members WHERE id=?','alice')},{name:'Deleted member',email:'deleted:alice',auth_id:'deleted:alice',role:'member',status:'deleted',balance:0});
ok(get('SELECT created_by,funded FROM quests WHERE id=?',q.id).created_by,'Deleted member');
ok(get('SELECT funded FROM quests WHERE id=?',q.id).funded,0);
ok(!!get('SELECT deleted_at FROM quests WHERE id=?',q.id).deleted_at,true);
ok(!!get('SELECT deleted_at FROM listings WHERE id=?',listing.id).deleted_at,true);
ok(get("SELECT SUM(amount) AS n FROM pp_events WHERE kind='account_retirement'").n,100);
ok(get("SELECT SUM(amount) AS n FROM pp_events WHERE kind='account_quest_refund'").n,20);
ok(rows('SELECT * FROM commands WHERE actor_id=?','alice').length,0);
ok(rows('SELECT * FROM welcome_claims WHERE fingerprint=?',fingerprint).length,1);
const count=get('SELECT COUNT(*) n FROM pp_events').n;await close();ok(get('SELECT COUNT(*) n FROM pp_events').n,count,'Retry does not move PP twice');
await rejects(()=>action('alice',{op:'rename',name:'Return'}));reconciles();

// New auth identity, same email: starter grant cannot be farmed. A different email still gets it.
for(const [id,email] of [['alice-new','alice@example.test'],['new-friend','new@example.test']]) {
  const f=await accountFingerprint(email,secret);
  await db.batch([
    db.prepare('INSERT INTO members(id,auth_id,email,name) VALUES(?,?,?,?)').bind(id,id,email,id),
    db.prepare("INSERT INTO pp_events(id,kind,actor_id,to_id,amount) SELECT ?,'welcome',?,?,100 WHERE NOT EXISTS(SELECT 1 FROM welcome_claims WHERE fingerprint=?)").bind('welcome:'+id,id,id,f),
    db.prepare('INSERT OR IGNORE INTO welcome_claims(fingerprint) VALUES(?)').bind(f),
  ]);
}
ok(get('SELECT balance FROM members WHERE id=?','alice-new').balance,0);
ok(get('SELECT balance FROM members WHERE id=?','new-friend').balance,100);reconciles();

reset();run("INSERT INTO pp_events(id,kind,actor_id,from_id,amount) VALUES('debt','quest_stake','alice','alice',120)");
await rejects(()=>close());ok(rows('SELECT * FROM account_deletions').length,0);ok(get('SELECT status FROM members WHERE id=?','alice').status,'active');

for(const participant of ['alice','bob']) {
  reset();const offer=await action('alice',{op:'create_listing',title:'Item',description:'Test',price:5,stock:1});
  const p=await action('bob',{op:'buy',listingId:offer.id,expectedPrice:5,revision:0});
  await rejects(()=>close(participant));await action('alice',{op:'purchase_ready',purchaseId:p.id});await rejects(()=>close(participant));
  await action('bob',{op:'purchase_cancel',purchaseId:p.id});await close(participant);reconciles();
}
reset();const future=await quest('bob',{eventAt:new Date(Date.now()+3600000).toISOString()});await action('alice',{op:'commit',questId:future.id,revision:0});
run("UPDATE quests SET event_at='2020-01-01T00:00:00Z' WHERE id=?",future.id);await rejects(()=>close());
run("UPDATE attendance SET status='reported' WHERE member_id='alice'");await rejects(()=>close());
run("UPDATE attendance SET status='attended' WHERE member_id='alice'");await close();reconciles();

reset();const owned=await quest();await action('bob',{op:'commit',questId:owned.id,revision:0});await rejects(()=>close());
await action('bob',{op:'submit',questId:owned.id,story:'Test story'});run("UPDATE attendance SET status='attended' WHERE member_id='bob'");await rejects(()=>close());

reset();const other=await quest('bob');await action('alice',{op:'commit',questId:other.id,revision:0});const submission=await action('alice',{op:'submit',questId:other.id,story:'Pending story'});
await close();ok(get('SELECT status FROM submissions WHERE id=?',submission.id).status,'withdrawn');ok(rows('SELECT * FROM reviews WHERE submission_id=?',submission.id).length,0);reconciles();

reset();const toReview=await quest('bob');await action('chris',{op:'commit',questId:toReview.id,revision:0});const s=await action('chris',{op:'submit',questId:toReview.id,story:'Another story'});
const reviewer=rows("SELECT reviewer_id FROM reviews WHERE submission_id=? AND decision='pending'",s.id)[0].reviewer_id;
await close(reviewer);await assignReviews(db);ok(rows("SELECT * FROM reviews WHERE reviewer_id=? AND decision='pending'",reviewer).length,0);ok(rows('SELECT * FROM reviews WHERE submission_id=?',s.id).length,2);

reset();run("INSERT INTO pp_events(id,kind,actor_id,to_id,amount) VALUES('large-1','admin_adjust','alice','alice',100000)");run("INSERT INTO pp_events(id,kind,actor_id,to_id,amount) VALUES('large-2','admin_adjust','alice','alice',100000)");
await close();ok(get("SELECT COUNT(*) n FROM pp_events WHERE kind='account_retirement'").n,3);reconciles();

// An already-refunded quest must not refund its pot again.
reset();const refunded=await quest();run('UPDATE quests SET funded=0,status=? WHERE id=?','cancelled',refunded.id);run("INSERT INTO pp_events(id,kind,actor_id,to_id,amount) VALUES('refund','admin_reversal','alice','alice',20)");
await close();ok(get("SELECT COUNT(*) n FROM pp_events WHERE kind='account_quest_refund'").n,0);reconciles();

reset();beforeBatch=()=>close();await rejects(()=>action('alice',{op:'create_quest',title:'Stale request',points:20}));ok(rows('SELECT * FROM quests').length,0);reconciles();
reset();const racing=await quest();beforeBatch=()=>action('bob',{op:'commit',questId:racing.id,revision:0});await rejects(()=>close());ok(get('SELECT status FROM members WHERE id=?','alice').status,'active');ok(rows('SELECT * FROM account_deletions').length,0);
reset();beforeBatch=()=>close();await close();ok(rows('SELECT * FROM account_deletions').length,1);reconciles();
reset();await close('unenrolled-auth');ok(rows('SELECT * FROM welcome_claims').length,0,'Deleting before enrollment does not burn welcome grant');
sqlite.close();

// Function authorization and cross-service failure boundaries, without real users or services.
const verified={id:'authenticated-user',email:'test@example.test',email_confirmed_at:'2026-01-01',identities:[{provider:'google'}]};
function request({method='POST',bearer=true,confirm=true}={}){return new Request('https://local.test/delete',{method,headers:{...(bearer?{Authorization:'Bearer synthetic-jwt'}:{}),...(confirm?{'X-Confirm-Deletion':'DELETE'}:{})},...(method==='POST'?{body:JSON.stringify({userId:'victim',callback:'https://attacker.test'})}:{})});}
let calls=[];
const deps={authenticate:async token=>{calls.push(['authenticate',token]);return verified;},ready:async token=>{calls.push(['ready',token]);return true;},revoke:async token=>calls.push(['revoke',token]),remove:async id=>calls.push(['remove',id])};
ok((await deleteLedgerAccount(request({method:'GET'}),deps)).status,405);
ok((await deleteLedgerAccount(request({bearer:false}),deps)).status,401);
ok((await deleteLedgerAccount(request({confirm:false}),deps)).status,400);ok(calls.length,0);
for(const user of [null,{...verified,email_confirmed_at:null},{...verified,identities:[{provider:'email'}]}])ok((await deleteLedgerAccount(request(),{...deps,authenticate:async()=>user})).status,401);
calls=[];ok((await deleteLedgerAccount(request(),{...deps,ready:async()=>false})).status,409);ok(calls.some(x=>x[0]==='remove'),false);
calls=[];ok((await deleteLedgerAccount(request(),{...deps,ready:async()=>{throw new Error('upstream');}})).status,503);ok(calls.some(x=>x[0]==='remove'),false);
calls=[];ok((await deleteLedgerAccount(request(),{...deps,revoke:async()=>{throw new Error('secret');}})).status,503);ok(calls.some(x=>x[0]==='remove'),false);
calls=[];const success=await deleteLedgerAccount(request(),deps);ok(success.status,200);ok(calls,[['authenticate','synthetic-jwt'],['ready','synthetic-jwt'],['revoke','synthetic-jwt'],['remove','authenticated-user']],'Caller-supplied target and callback ignored');
const failed=await deleteLedgerAccount(request(),{...deps,remove:async()=>{throw new Error('provider-secret');}});ok(failed.status,503);ok((await failed.text()).includes('provider-secret'),false);
console.log('PASS: '+checks+' account deletion, retries, PP conservation, blockers, races, re-enrollment, and function authorization checks.');
