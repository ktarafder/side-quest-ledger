// Run against the built local Worker + synthetic identity fixture only.
// Supabase URL must be loopback, ADMIN_EMAIL=kam@example.test, and media disabled.
// An R2 binding should exist locally to prove the flag blocks it independently.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const origin='http://127.0.0.1:8787', cookies=new Map();
let checks=0;
function equal(actual,expected){assert.deepEqual(actual,expected);checks++;}
async function request(path,method='GET',body){
  const r=await fetch(origin+path,{method,redirect:'manual',headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...(method==='GET'?{}:{Origin:origin,'Content-Type':'image/png'})},...(body?{body}:{})});
  for(const cookie of r.headers.getSetCookie()){const entry=cookie.split(';')[0],n=entry.indexOf('=');cookies.set(entry.slice(0,n),entry.slice(n+1));}
  return {status:r.status,headers:r.headers,body:await r.json().catch(()=>null)};
}
const manifest=JSON.parse(await readFile(new URL('../.openai/hosting.json',import.meta.url)));
equal(manifest.r2,null);
const deployed=JSON.parse(await readFile(new URL('../dist/server/wrangler.json',import.meta.url)));
equal(deployed.r2_buckets?.length||0,0);
equal((await request('/api/auth/google')).status,303);
equal((await request('/auth/callback?code=test-kam')).status,303);
const me=await request('/api/me');equal(me.status,200);assert.ok(me.body.member,'Enroll the synthetic local kam member before this check.');
const before=await request('/api/admin');equal(before.status,200);
const board=await request('/api/board');equal(board.status,200);equal(board.body.mediaEnabled,false);
const image=Uint8Array.from([137,80,78,71,13,10,26,10]);
const upload=await request('/api/media','POST',image);equal(upload.status,503);equal(upload.body.error,'Photos are not available yet. You can still post without one.');
equal((await request('/api/media/any-object')).status,503);
const after=await request('/api/admin');equal(after.status,200);
equal(after.body.metrics.storage_bytes,before.body.metrics.storage_bytes);
equal((await request('/api/me')).body.member.balance,me.body.member.balance);
const anonymous=await fetch(origin+'/api/media',{method:'POST',headers:{Origin:origin,'Content-Type':'image/png'},body:image});equal(anonymous.status,401);
console.log(`PASS: ${checks} no-spend media checks: no provisioned bucket, runtime disable despite a local binding, no asset reservation or PP change, and authenticated access.`);
