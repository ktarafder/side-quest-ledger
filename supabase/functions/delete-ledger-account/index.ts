import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { deleteLedgerAccount } from "./handler.mjs";

// Supabase supplies these secrets inside the function. They never enter the Worker or browser.
const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
const admin=createClient(Deno.env.get("SUPABASE_URL")!,keys.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const origin="https://side-quest-ledger.dreamycedar64.chatgpt.site";
Deno.serve(request=>deleteLedgerAccount(request,{
  async authenticate(token:string) {const {data,error}=await admin.auth.getUser(token);if(error)return null;return data.user;},
  async ready(token:string) {const r=await fetch(origin+"/api/account/deletion-status",{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error("Status unavailable");return (await r.json()).ready===true;},
  async revoke(token:string) {const {error}=await admin.auth.admin.signOut(token,"global");if(error)throw error;},
  async remove(id:string) {const {error}=await admin.auth.admin.deleteUser(id);if(error)throw error;},
}));
