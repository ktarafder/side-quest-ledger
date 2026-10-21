// All dependencies are server-owned. Request data never selects another user or callback URL.
export async function deleteLedgerAccount(request, deps) {
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(request.method!=='POST') return reply({error:'Use POST.'},405);
  const header=request.headers.get('authorization')||'';
  if(!header.startsWith('Bearer ') || header.length>12000) return reply({error:'Sign in first.'},401);
  if(request.headers.get('x-confirm-deletion')!=='DELETE') return reply({error:'Confirmation required.'},400);
  const token=header.slice(7);
  try {
    const user=await deps.authenticate(token);
    if(!user?.id || !user.email || !user.email_confirmed_at || !user.identities?.some(x=>x.provider==='google')) return reply({error:'Verified Google identity required.'},401);
    if(!await deps.ready(token)) return reply({error:'Close your ledger profile first.'},409);
    await deps.revoke(token);
    await deps.remove(user.id);
    return reply({ok:true});
  } catch {return reply({error:'Could not finish account deletion. Please retry.'},503);}
}
