"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import QuestGate from "./quest-gate";
import { ArrowUpRight, Plus, X, Check, Heart, LogOut, Trash2, RotateCcw, Gift } from "lucide-react";

type Row = Record<string, any>;
type Board = {mediaEnabled:boolean;member:Row; quests:Row[]; attendance:Row[]; leaderboard:Row[]; listings:Row[]; purchases:Row[]; archive:Row[]; reviews:Row[]; wallet:Row[]; legacy:Row[]; submissions:Row[]; stats:Row};
type ModalState = {kind:string; item?:Row; op?:string; params?:Row; title?:string};
class ApiError extends Error { constructor(message:string,public status:number){super(message);} }
async function api(path:string, options?:RequestInit) {
  const response=await fetch(path,{...options,headers:{"Content-Type":"application/json",...options?.headers}});
  const body=await response.json().catch(()=>({})) as any;
  if(!response.ok) throw new ApiError(body.error || "Something went sideways.",response.status);
  return body;
}
const categories:Record<string,{label:string;glyph:string}> = {
  move:{label:"MOVE",glyph:"动"},make:{label:"MAKE",glyph:"造"},wander:{label:"WANDER",glyph:"游"},
  connect:{label:"CONNECT",glyph:"聚"},learn:{label:"LEARN",glyph:"学"},misc:{label:"OTHER",glyph:"支"},
};
const pp=(value:number)=>new Intl.NumberFormat().format(value)+" PP";
const date=(value:string)=>new Date(value.replace(" ","T")+(value.includes("T")?"":"Z")).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"});
function localDateTime(value?:string) {
  if(!value) return "";
  const instant=new Date(value);
  return new Date(instant.getTime()-instant.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function Photo({id,alt}:{id?:string;alt:string}) { return id ? <img className="memory-photo" src={"/api/media/"+id} alt={alt} loading="lazy" /> : null; }
function Empty({children}:{children:ReactNode}) { return <p className="empty-note">{children}</p>; }
function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const node=ref.current; node?.showModal();return()=>{node?.close();};},[]);
  return <dialog ref={ref} className="modal-card ledger-dialog" onCancel={event=>{event.preventDefault();onClose();}}>
    <div className="modal-header"><div><span>SIDE QUEST LEDGER</span><h2>{title}</h2></div><button type="button" aria-label="Close dialog" onClick={onClose}><X /></button></div>{children}
  </dialog>;
}
async function upload(file:File|null) {
  if(!file?.size) return null;
  if(!file.type.startsWith("image/")) throw new Error("Choose a photo.");
  const objectUrl=URL.createObjectURL(file), image=new Image();
  try {
    image.src=objectUrl; await image.decode();
    const scale=Math.min(1,1600/Math.max(image.width,image.height)), canvas=document.createElement("canvas");
    canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
    const context=canvas.getContext("2d"); if(!context) throw new Error("Could not prepare photo.");
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",0.82));
    if(!blob || blob.size>2097152) throw new Error("Choose a smaller photo (under 2 MB).");
    const response=await fetch("/api/media",{method:"POST",headers:{"Content-Type":"image/jpeg"},body:blob});
    const result=await response.json() as {id:string;error?:string}; if(!response.ok) throw new Error(result.error || "Photo upload failed.");
    return result.id as string;
  } finally { URL.revokeObjectURL(objectUrl); }
}
export default function Ledger({adminPage=false}:{adminPage?:boolean}) {
  const [stage,setStage]=useState("loading"),[board,setBoard]=useState<Board|null>(null),[admin,setAdmin]=useState<Row|null>(null);
  const [tab,setTab]=useState(adminPage?"admin":"quests"),[filter,setFilter]=useState("active"),[modal,setModal]=useState<ModalState|null>(null);
  const [error,setError]=useState(""),[busy,setBusy]=useState(false),[quiz,setQuiz]=useState<Row|null>(null),[archivePage,setArchivePage]=useState(0);
  const [stake,setStake]=useState(20);
  const requests=useRef(new Map<string,string>());
  const reload=useCallback(async(page=0)=>{
    const adminData=adminPage?await api("/api/admin"):null;
    const data=await api("/api/board?archivePage="+page);
    setBoard(data);setStage("board");
    setAdmin(adminData);
  },[adminPage]);
  const boot=useCallback(async()=>{
    try {
      const me=await api("/api/me");
      if(!me.configured) {setStage("setup");return;}
      if(me.deleting){setStage("deleting");return;}
      if(!me.member) {setStage("register");return;}
      if(me.member.status!=="active"){setStage("blocked");return;}
      await reload();
    }catch(err){if(err instanceof ApiError && err.status===401)setStage("signin");else if(adminPage&&err instanceof ApiError&&err.status===403){setAdmin(null);setBoard(null);setStage("forbidden");}else{setError(err instanceof Error?err.message:"Could not load the board.");setStage("error");}}
  },[reload,adminPage]);
  useEffect(()=>{void boot();},[boot]);
  useEffect(()=>{
    if(stage!=="board")return;
    const timer=setInterval(()=>{if(!document.hidden) void reload(archivePage).catch(()=>{});},30000);
    return()=>clearInterval(timer);
  },[stage,reload,archivePage]);
  async function act(body:Row,close=true) {
    const signature=JSON.stringify(body),key=requests.current.get(signature)||crypto.randomUUID();
    requests.current.set(signature,key);setBusy(true);setError("");
    try {await api("/api/actions",{method:"POST",headers:{"Idempotency-Key":key},body:signature});requests.current.delete(signature);if(close)setModal(null);await reload(archivePage);}
    catch(err){setError(err instanceof Error?err.message:"Could not save that change.");if(["buy","commit","edit_quest","edit_listing","admin_reassign_review"].includes(body.op)&&err instanceof ApiError&&err.status===409){setModal(null);await reload(archivePage).catch(()=>{});}}
    finally{setBusy(false);}
  }
  async function submitModal(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const data=new FormData(event.currentTarget);if(!modal)return;
    setBusy(true);setError("");
    try {
      const values=Object.fromEntries(data),m=modal;
      if(m.kind==="quest") await act({op:"create_quest",title:values.title,description:values.description,reward:values.reward,points:Number(values.points),category:values.category,eventAt:values.eventAt?new Date(String(values.eventAt)).toISOString():null});
      else if(m.kind==="edit_quest") await act({op:"edit_quest",questId:m.item!.id,revision:m.item!.revision,title:values.title,description:values.description,reward:values.reward,category:values.category,eventAt:values.eventAt?new Date(String(values.eventAt)).toISOString():null});
      else if(m.kind==="listing") {const assetId=await upload(data.get("photo") as File);await act({op:"create_listing",title:values.title,description:values.description,price:Number(values.price),stock:Number(values.stock),assetId});}
      else if(m.kind==="edit_listing") await act({op:"edit_listing",listingId:m.item!.id,revision:m.item!.revision,title:values.title,description:values.description,price:Number(values.price),addStock:Number(values.addStock||0)});
      else if(m.kind==="story") {const assetId=await upload(data.get("photo") as File);await act({op:"submit",questId:m.item!.id,story:values.story,assetId});}
      else if(m.kind==="tip") await act({op:"tip",memberId:values.memberId,amount:Number(values.amount),note:values.note});
      else if(m.kind==="delete_account") {await api("/api/account/delete",{method:"POST",body:JSON.stringify({confirmation:values.confirmation})});setBoard(null);setAdmin(null);setQuiz(null);setArchivePage(0);setModal(null);requests.current.clear();setStage("signin");}
      else if(m.kind==="rename") await act({op:"rename",name:values.name});
      else if(m.kind==="reject") await act({op:"review",submissionId:m.item!.submission_id,decision:"reject",note:values.note});
      else if(m.kind==="admin") await act({op:m.op,...m.params,reason:values.reason,...(m.op==="admin_adjust"?{memberId:values.memberId,amount:Number(values.amount)}:{}),...(m.op==="admin_assign_legacy"?{memberId:values.memberId}:{})});
      else if(m.kind==="buy") await act({op:"buy",listingId:m.item!.id,expectedPrice:m.item!.price,revision:m.item!.revision});
      else if(m.kind==="delete") await act({op:"delete_quest",questId:m.item!.id});
    }catch(err){setError(err instanceof Error?err.message:"Could not save this.");}finally{if(modal?.kind==="delete_account"){setModal(null);await boot();}setBusy(false);}
  }
  async function getQuiz() {setBusy(true);setError("");try{setQuiz(await api("/api/register"));}catch(err){setError(err instanceof Error?err.message:"Could not load questions.");}finally{setBusy(false);}}
  async function register(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const values=new FormData(event.currentTarget),answers:Row={};for(const q of quiz!.questions)answers[q.id]=values.get(q.id);
    setBusy(true);setError("");try{await api("/api/register",{method:"POST",body:JSON.stringify({name:values.get("name"),challengeId:quiz!.id,answers})});await boot();}catch(err){setError(err instanceof Error?err.message:"Could not join.");}finally{setBusy(false);}
  }
  const person=board?.member;
  const adminAction=(title:string,op:string,params:Row={})=>setModal({kind:"admin",title,op,params});
  if(stage==="loading")return <main className="loading-screen"><span className="loading-mark" aria-label="Loading">支</span></main>;
  if(stage!=="board" || !board || !person)return <QuestGate enrolling={stage==="register"&&!!quiz}>
    {stage==="signin" && <div className="signup-action"><a className="submit-button login-button" href="/api/auth/google">CONTINUE WITH GOOGLE <ArrowUpRight size={19}/></a></div>}
    {stage==="setup" && <div className="setup-note"><b>Google sign-in is being connected.</b><p>The member board opens once setup is complete.</p><button className="text-button" onClick={()=>void boot()}>CHECK AGAIN</button></div>}
    {stage==="register" && <div className="registration"><h2>You're nearly in.</h2><p>Three group questions. Then your first 100 PP.</p>
      {!quiz?<button className="submit-button" disabled={busy} onClick={()=>void getQuiz()}>START GROUP CHECK</button>:<form onSubmit={register} className="enrollment-form">
        <label>Your name<input name="name" maxLength={40} required autoComplete="nickname"/></label>
        {quiz.questions.map((q:Row)=><label key={q.id}>{q.question}<input name={q.id} maxLength={200} required autoComplete="off"/></label>)}
        <div className="enrollment-actions"><button className="submit-button" disabled={busy}>JOIN THE LEDGER <ArrowUpRight size={18}/></button><button className="text-button" type="button" disabled={busy} onClick={()=>void getQuiz()}>GET A FRESH SET</button></div>
      </form>}
    </div>}
    {stage==="forbidden" && <><h2>Admin access only.</h2><p className="gate-copy">This dashboard is only available to Kamrul’s admin account.</p><a className="submit-button" href="/">BACK TO THE LEDGER</a></>}
    {stage==="deleting"&&<div className="registration"><h2>Finish deleting your account.</h2><p>Your ledger profile is closed. Confirm once more to retry removing your Google sign-in account from this app.</p><form className="enrollment-form" onSubmit={async event=>{event.preventDefault();setBusy(true);setError("");try{await api("/api/account/delete",{method:"POST",body:JSON.stringify({confirmation:new FormData(event.currentTarget).get("confirmation")})});setQuiz(null);await boot();}catch(err){setError(err instanceof Error?err.message:"Could not finish deleting.");await boot();}finally{setBusy(false);}}}><label>Type DELETE to confirm<input name="confirmation" required pattern="DELETE" autoComplete="off"/></label><button className="submit-button" disabled={busy}>FINISH DELETION</button></form></div>}
    {stage==="blocked" && <p>Your membership is paused. Contact Kamrul.</p>}
    {stage==="error" && <button className="submit-button" onClick={()=>void boot()}>TRY AGAIN</button>}
    {error&&<p className="error-line" role="alert">{error}</p>}
  </QuestGate>;

  return <main id="top" className="app-shell">
    <header className="topbar">
      <a className="brand" href={adminPage?"/":"#top"}><span>支</span><div>SIDE QUEST<br/>LEDGER</div></a>
      <div className="week-signal"><i/><span className="membership-label">FRIENDS ONLY</span><b>{pp(person.balance)}</b></div>
      <div className="user-controls"><button className="user-badge" title="Account settings" aria-label="Account settings" onClick={()=>setModal({kind:"rename"})}><span>{person.name}</span></button>
      <button className="icon-button" title="Sign out" aria-label="Sign out" onClick={async()=>{await api("/api/auth/logout",{method:"POST",body:"{}"});setBoard(null);setAdmin(null);setStage("signin");}}><LogOut size={16}/></button></div>
    </header>
    {!adminPage&&<><section className="stats-strip" aria-label="Board stats">
      <div><span>OPEN QUESTS</span><strong>{board.stats.open}</strong></div><div><span>IN REVIEW</span><strong>{board.stats.pending}</strong></div>
      <div><span>VERIFIED</span><strong>{board.stats.completed}</strong></div><div className="points"><span>YOUR POWER POINTS</span><strong>{person.balance}<small> PP</small></strong></div>
    </section>
    <nav className="section-nav" aria-label="Ledger sections">{[["quests","QUESTS"],["reviews","REVIEWS"+(board.reviews.length?" ("+board.reviews.length+")":"")],["market","MARKET"],["leaderboard","LEADERBOARD"],["memories","MEMORIES"],["wallet","MY PP"]].map(([id,label])=><button key={id} aria-current={tab===id?"page":undefined} className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}</button>)}</nav></>}
    {adminPage?<nav className="section-nav" aria-label="Admin navigation"><a href="/">← BACK TO THE LEDGER</a><span aria-current="page">ADMIN</span></nav>:person.role==="admin"&&<div className="admin-entry"><a href="/admin">ADMIN DASHBOARD <ArrowUpRight size={13}/></a></div>}
    {error&&!modal&&<div className="inline-error" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss error"><X size={16}/></button></div>}

    {tab==="quests"&&<>
      <div className="board-controls"><div className="filter-tabs">{["active","completed","all"].map(f=><button key={f} className={filter===f?"active":""} onClick={()=>setFilter(f)}>{f.toUpperCase()}</button>)}</div><button className="add-button" onClick={()=>{setStake(20);setModal({kind:"quest"});}}><Plus size={16}/> ADD SIDE QUEST</button></div>
      <section className="quest-grid">
        {board.quests.filter(q=>filter==="all"||(filter==="completed"?q.status==="completed":q.status==="open")).map(q=>{
          const meta=categories[q.category]||categories.misc,people=board.attendance.filter(a=>a.quest_id===q.id&&a.status!=="left"),mine=people.find(a=>a.member_id===person.id),pending=board.submissions.find(s=>s.quest_id===q.id&&s.member_id===person.id&&s.status==="pending"),rejected=board.submissions.find(s=>s.quest_id===q.id&&s.member_id===person.id&&s.status==="rejected");
          return <article key={q.id} className={"quest-card "+(q.status==="completed"?"completed":mine?.status==="committed"?"claimed":"open")}>
            <div className="card-topline"><span className="category"><b>{meta.glyph}</b>{meta.label}</span><span className="quest-id">SQ-{String(q.id).padStart(3,"0")}</span></div>
            <div className="quest-copy"><h2>{q.title}</h2><p className="quest-creator">{q.owner_name?"Added by "+q.owner_name:"Legacy · creator "+(q.created_by||"not recorded")}</p><p>{q.description}</p>{q.event_at&&<p className="event-time">{date(q.event_at)}</p>}</div>
            <div className="reward-row"><span><small>{q.funded?"FIRST VERIFIED FINISHER WINS":"LEGACY · NO FUNDED POT"}</small><b>{q.reward||"A good story"}</b></span><span className="xp">{pp(q.points)}</span></div>
            <div className="participant-row">{people.length?people.map(a=><span className={"participant-chip "+(a.status==="attended"?"completed":"")} key={a.id}>{a.name} · {a.status.replaceAll("_"," ")}</span>):<span className="participant-empty">No takers yet</span>}
            {board.legacy.filter(p=>p.quest_id===q.id).map(p=><span className="participant-chip" key={"legacy"+p.id}>{p.name} · legacy {p.status}</span>)}</div>
            {pending&&<p className="card-note">In review · {pending.approvals}/2 approvals · {pending.assigned}/2 reviewers assigned</p>}
            {!pending&&rejected&&<p className="card-note">Changes requested: {rejected.feedback}</p>}
            <div className="card-actions">
              {q.owner_id===person.id&&q.status==="open"&&!people.some(a=>["committed","reported","no_show","attended"].includes(a.status))&&!board.submissions.some(s=>s.quest_id===q.id)&&!board.legacy.some(p=>p.quest_id===q.id)&&<button disabled={busy} onClick={()=>setModal({kind:"edit_quest",item:q})}>EDIT DETAILS</button>}
              {q.status==="open"&&<><button disabled={busy||mine?.status==="interested"||["reported","no_show"].includes(mine?.status)} onClick={()=>void act({op:"interested",questId:q.id},false)}>INTERESTED</button>
              {q.owner_id!==person.id&&<button disabled={busy||!!pending||["committed","reported","no_show"].includes(mine?.status)} onClick={()=>void act({op:"commit",questId:q.id,revision:q.revision},false)}>{mine?.status==="committed"?"COMMITTED":"COMMIT"}</button>}
              {mine?.status==="committed"&&!pending&&<button disabled={busy} onClick={()=>setModal({kind:"story",item:q})}><Check size={14}/> SUBMIT</button>}
              {mine&&!pending&&!["attended","reported","no_show"].includes(mine.status)&&<button disabled={busy} className="release" onClick={()=>void act({op:"leave",questId:q.id},false)}>LEAVE</button>}</>}
              {q.status==="completed"&&mine?.status==="committed"&&!pending&&<button disabled={busy} onClick={()=>setModal({kind:"story",item:q})}>ADD COMPLETION</button>}
              {(q.owner_id===person.id||person.role==="admin")&&<button className="delete" aria-label={"Archive "+q.title} onClick={()=>setModal({kind:"delete",item:q})}><Trash2 size={14}/></button>}
            </div>
            {(q.owner_id===person.id||person.role==="admin")&&q.event_at&&Date.parse(q.event_at)<Date.now()&&people.filter(a=>a.status==="committed").map(a=><button className="text-button report-button" key={a.id} disabled={busy} onClick={()=>void act({op:"report_no_show",questId:q.id,memberId:a.member_id,reason:"Organizer reported no-show"},false)}>REPORT NO-SHOW · {a.name}</button>)}
          </article>;
        })}
        {!board.quests.some(q=>filter==="all"||(filter==="completed"?q.status==="completed":q.status==="open"))&&<button className="empty-card" onClick={()=>setModal({kind:"quest"})}><Plus size={24}/><b>Nothing here yet.</b><span>Plant a side quest.</span></button>}
      </section><p className="section-footnote">10–35 PP per funded quest. If your balance cannot cover the stake, a 20 PP quest is posted and your balance can go negative. Committed no-shows cost 10 PP after admin confirmation.</p>
    </>}

    {tab==="reviews"&&<section className="content-section"><div className="section-heading"><h2>Your review queue</h2><p>Two randomly assigned members verify each completion.</p></div>
      {!board.reviews.length&&<Empty>You're all caught up. New assignments will appear here.</Empty>}
      <div className="quest-grid inset-grid">{board.reviews.map(r=><article className="quest-card" key={r.id}><div className="quest-copy"><p className="quest-creator">{r.name} · {date(r.submitted_at)}</p><h2>{r.title}</h2><p>{r.story}</p><Photo id={r.asset_id} alt={"Completion by "+r.name}/><p className="card-note">{r.approvals}/2 approvals so far</p></div><div className="card-actions"><button disabled={busy} onClick={()=>void act({op:"review",submissionId:r.submission_id,decision:"approve",note:""},false)}><Check size={14}/> APPROVE</button><button disabled={busy} onClick={()=>setModal({kind:"reject",item:r})}>REQUEST CHANGES</button></div></article>)}</div>
    </section>}

    {tab==="market"&&<section className="content-section"><div className="section-heading"><div><h2>The market</h2><p>Things and experiences offered by friends. Prices set by their owners.</p></div><button className="add-button" onClick={()=>setModal({kind:"listing"})}><Plus size={16}/> POST AN ITEM</button></div>
      {!board.listings.length&&<Empty>No offers yet. Put something good on the market.</Empty>}
      <div className="quest-grid inset-grid">{board.listings.map(l=><article className="quest-card" key={l.id}><div className="quest-copy"><p className="quest-creator">Offered by {l.owner_name}</p><h2>{l.title}</h2><p>{l.description}</p><Photo id={l.asset_id} alt={l.title}/></div><div className="reward-row"><b>{l.stock} available</b><span className="xp">{pp(l.price)}</span></div><div className="card-actions">{l.owner_id!==person.id?<button disabled={busy||l.stock<1||person.balance<l.price} onClick={()=>setModal({kind:"buy",item:l})}>BUY FOR {pp(l.price)}</button>:<><button disabled={busy} onClick={()=>setModal({kind:"edit_listing",item:l})}>EDIT & RESTOCK</button><button disabled={busy} onClick={()=>void act({op:"delete_listing",listingId:l.id},false)}>REMOVE LISTING</button></>}</div></article>)}</div>
      <h3>Your purchases & sales</h3>{!board.purchases.length&&<Empty>No transactions yet.</Empty>}
      {board.purchases.map(p=><div className="list-row" key={p.id}><div><b>{p.title} · {pp(p.price)}</b><p>{p.buyer_name} → {p.seller_name} · {p.status}</p></div><div className="row-actions">
        {p.seller_id===person.id&&p.status==="pending"&&<button disabled={busy} onClick={()=>void act({op:"purchase_ready",purchaseId:p.id},false)}>MARK READY</button>}
        {p.buyer_id===person.id&&["pending","ready"].includes(p.status)&&<button disabled={busy} onClick={()=>void act({op:"purchase_received",purchaseId:p.id},false)}>RECEIVED · RELEASE PP</button>}
        {["pending","ready"].includes(p.status)&&<button disabled={busy} onClick={()=>void act({op:"purchase_cancel",purchaseId:p.id},false)}>CANCEL & REFUND</button>}
      </div></div>)}<p className="helper">Buying reserves PP. The seller receives them when you confirm receipt. A cancelled purchase returns the reservation.</p>
    </section>}

    {tab==="leaderboard"&&<section className="content-section"><div className="section-heading"><h2>Power ranking</h2><button className="add-button" disabled={person.balance<=0} onClick={()=>setModal({kind:"tip"})}><Gift size={16}/> TIP A FRIEND</button></div>
      <p>Ranked by current PP balance, including stakes, tips, purchases, and penalties.</p>
      <div className="leaderboard">{board.leaderboard.map((m,index)=><div className="rank-row" key={m.id}><span className="rank-number">{String(index+1).padStart(2,"0")}</span><div><b>{m.name}{m.id===person.id?" (you)":""}</b><p>{m.completed} verified · {m.kudos} kudos</p></div><strong>{pp(m.balance)}</strong>{m.id!==person.id&&<button className="text-button" disabled={person.balance<=0} onClick={()=>setModal({kind:"tip",item:m})}>TIP</button>}</div>)}</div>
    </section>}

    {tab==="memories"&&<section className="content-section"><div className="section-heading"><h2>Stories worth keeping</h2><p>Verified adventures from the group.</p></div>
      {!board.archive.length&&<Empty>The first verified quest starts the archive.</Empty>}
      <div className="quest-grid inset-grid">{board.archive.map(s=><article className="quest-card" key={s.id}><div className="quest-copy"><p className="quest-creator">{s.name} · {date(s.decided_at)}</p><h2>{s.title}</h2><p>{s.story}</p><Photo id={s.asset_id} alt={s.title+" — "+s.name}/><p className="card-note">{s.winner_submission_id===s.id?"First verified finisher":"Verified completion"}</p></div><div className="card-actions"><button disabled={busy||!!s.my_kudos||s.member_id===person.id} onClick={()=>void act({op:"kudos",submissionId:s.id},false)}><Heart size={15} fill={s.my_kudos?"currentColor":"none"}/> {s.kudos} KUDOS{s.my_kudos?" · GIVEN":""}</button></div></article>)}</div>
      <div className="pagination"><button disabled={busy||archivePage===0} onClick={()=>{setArchivePage(p=>p-1);void reload(archivePage-1);}}>PREVIOUS</button><span>Page {archivePage+1}</span><button disabled={busy||board.archive.length<50} onClick={()=>{setArchivePage(p=>p+1);void reload(archivePage+1);}}>NEXT</button></div>
    </section>}

    {tab==="wallet"&&<section className="content-section"><div className="section-heading"><div><h2>Your Power Points</h2><p>Current balance: <b>{pp(person.balance)}</b></p></div><button className="add-button" disabled={person.balance<=0} onClick={()=>setModal({kind:"tip"})}><Gift size={16}/> SEND A TIP</button></div>
      <p className="helper">Your latest 100 entries. Stakes and purchase reservations leave your available balance immediately.</p>
      <div className="table-scroll"><table><thead><tr><th>When</th><th>Event</th><th>With</th><th>Change</th></tr></thead><tbody>{board.wallet.map(e=><tr key={e.id}><td>{date(e.created_at)}</td><td>{e.kind.replaceAll("_"," ")}<small>{e.reason}</small></td><td>{e.from_id===person.id?e.to_name||"Reserved / system":e.from_name||"System / reserved"}</td><td className={e.to_id===person.id?"positive":""}>{e.to_id===person.id?"+":"−"}{pp(e.amount)}</td></tr>)}</tbody></table></div>
    </section>}

    {tab==="admin"&&admin&&<section className="content-section admin-section"><div className="section-heading"><div><p className="eyebrow">KAMRUL ONLY</p><h2>Circulation & control</h2></div><button className="add-button" onClick={()=>adminAction("Adjust a balance","admin_adjust")}>ADJUST PP</button></div>
      <div className="metric-grid">{[["MEMBERS",admin.metrics.members],["NET PP IN WALLETS",admin.metrics.circulation],["QUEST POTS",admin.metrics.quest_escrow],["PURCHASE HOLDS",admin.metrics.purchase_escrow],["TOTAL DEBT",admin.metrics.debt],["STARTER PP ISSUED",admin.metrics.starter_issued],["PURCHASES",admin.metrics.purchases],["PHOTO STORAGE",board.mediaEnabled?((admin.metrics.storage_bytes||0)/1048576).toFixed(1)+" MB / 8 GB":"PAUSED"]].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
      <h3>Reported no-shows</h3>{!admin.noShows.length&&<Empty>No reports to resolve.</Empty>}{admin.noShows.map((a:Row)=><div className="list-row" key={a.id}><div><b>{a.name} · {a.title}</b><p>{date(a.event_at)}</p></div><button disabled={busy} onClick={()=>adminAction("Confirm a 10 PP no-show fee","admin_no_show",{questId:a.quest_id,memberId:a.member_id})}>CONFIRM −10 PP</button><button disabled={busy} onClick={()=>adminAction("Dismiss no-show report","admin_dismiss_no_show",{questId:a.quest_id,memberId:a.member_id})}>DISMISS</button></div>)}
      <h3>Pending reviews</h3><button className="text-button" disabled={busy} onClick={()=>adminAction("Fill empty reviewer slots","admin_assign_reviews")}>ASSIGN AVAILABLE REVIEWERS</button>{admin.pending.map((s:Row)=><div className="review-recovery" key={s.id}><div className="list-row"><b>{s.name} · {s.title}</b><span>{s.assigned}/2 assigned · {s.approvals}/2 approved</span></div>{admin.pendingReviewers.filter((r:Row)=>r.submission_id===s.id).map((r:Row)=><div className="list-row" key={r.id}><div><b>{r.name}</b><p>Assigned {date(r.created_at)}</p></div><button disabled={busy} onClick={()=>adminAction("Replace pending reviewer","admin_reassign_review",{reviewId:r.id})}>REASSIGN RANDOMLY</button></div>)}</div>)}
      <h3>Purchases</h3>{admin.purchases.map((p:Row)=><div className="list-row" key={p.id}><div><b>{p.title} · {pp(p.price)}</b><p>{p.buyer_name} → {p.seller_name} · {p.status}</p></div>{p.status!=="refunded"&&<button disabled={busy} onClick={()=>adminAction("Refund this purchase","admin_refund_purchase",{purchaseId:p.id})}>REFUND</button>}</div>)}
      <h3>PP event history</h3><p className="helper">Reversals preserve the original entry and may create debt if those points have already been spent.</p>
      <div className="table-scroll"><table><thead><tr><th>Event</th><th>From → To</th><th>PP</th><th>Recovery</th></tr></thead><tbody>{admin.events.map((e:Row)=><tr key={e.id}><td>{e.kind.replaceAll("_"," ")}<small>{date(e.created_at)} · {e.reason}</small></td><td>{e.from_name||"Reserved / system"} → {e.to_name||"Reserved / system"}</td><td>{e.amount}</td><td>{["tip","no_show","quest_payout","quest_stake"].includes(e.kind)&&!e.reversed?<button disabled={busy} onClick={()=>adminAction("Reverse this PP event","admin_reverse_event",{eventId:e.id})}>REVERSE</button>:e.reversed?"REVERSED":"—"}</td></tr>)}</tbody></table></div>
      {admin.events.length===100&&<button className="text-button" onClick={async()=>{setAdmin(await api("/api/admin?before="+admin.events[admin.events.length-1].seq));}}>OLDER EVENTS</button>}
      <h3>Recovery bin</h3>{[...admin.deletedQuests.map((q:Row)=>({...q,type:"quest"})),...admin.deletedListings.map((l:Row)=>({...l,type:"listing"}))].map((item:Row)=><div className="list-row" key={item.type+item.id}><b>{item.title} · {item.type}</b><button disabled={busy} onClick={()=>adminAction("Restore "+item.type,"admin_restore_"+item.type,{[item.type==="quest"?"questId":"listingId"]:item.id})}><RotateCcw size={13}/> RESTORE</button></div>)}
      <h3>Legacy ownership</h3><p className="helper">Old names are historical labels. Assign owners deliberately; past activity is not automatically converted into PP.</p>{admin.legacy.map((q:Row)=><div className="list-row" key={q.id}><b>{q.title}</b><button onClick={()=>adminAction("Assign legacy quest owner","admin_assign_legacy",{questId:q.id})}>ASSIGN OWNER</button></div>)}
      <h3>Admin audit</h3>{admin.audit.map((a:Row)=><div className="list-row" key={a.id}><div><b>{a.action.replaceAll("_"," ")}</b><p>{a.reason}</p></div><small>{a.name} · {date(a.created_at)}</small></div>)}
    </section>}

    <footer className="site-footer"><span>BUILD A LIFE OFFLINE.</span><span>MORE STORIES. GOOD COMPANY.</span></footer>
    {modal&&<Modal title={modal.title||({quest:"Plant a side quest",edit_quest:"Edit quest details",listing:"Put it on the market",edit_listing:"Edit & restock",story:"Come back with a story",tip:"Tip a friend",rename:"Your account",delete_account:"Delete your account?",reject:"Request changes",buy:"Make it yours",delete:"Archive this quest?"}[modal.kind]||"Make a change")} onClose={()=>{if(!busy){setModal(null);setError("");}}}>
      <form className="ledger-form" onSubmit={submitModal}>
      {["quest","edit_quest"].includes(modal.kind)&&<>
        <label>QUEST NAME<input name="title" maxLength={100} defaultValue={modal.item?.title} required autoFocus/></label>
        <label>FIELD NOTES<textarea name="description" maxLength={2000} defaultValue={modal.item?.description} placeholder="What counts as done? Where and when?"/></label>
        <label>EXTRA REWARD<input name="reward" maxLength={200} defaultValue={modal.item?.reward} placeholder="Optional, beyond the PP pot"/></label>
        <div className="form-grid"><label>CATEGORY<select name="category" defaultValue={modal.item?.category||"wander"}>{Object.entries(categories).map(([key,m])=><option key={key} value={key}>{m.glyph} · {m.label}</option>)}</select></label>{modal.kind==="quest"&&<label>PP STAKE<input name="points" type="number" min={10} max={35} required value={stake} onChange={e=>setStake(Number(e.target.value))}/></label>}</div>
        <p className="helper">{modal.kind==="edit_quest"?"Your "+pp(modal.item!.points)+" stake stays unchanged. Details lock while someone is committed or after a submission.":person.balance>=stake?"This reserves "+pp(stake)+". First finisher approved by both reviewers wins.":"Your balance cannot cover this stake. This quest will be worth 20 PP and your balance will become "+pp(person.balance-20)+"."}</p>
        <label>SCHEDULED TIME (OPTIONAL)<input type="datetime-local" name="eventAt" defaultValue={localDateTime(modal.item?.event_at)}/></label>
      </>}
      {modal.kind==="listing"&&<>
        <label>ITEM OR EXPERIENCE<input name="title" maxLength={100} required autoFocus/></label><label>WHAT'S INCLUDED<textarea name="description" maxLength={2000} required placeholder="Describe the item, condition, and how you'll hand it over."/></label>
        <div className="form-grid"><label>PRICE IN PP<input name="price" type="number" min={1} max={100000} required/></label><label>QUANTITY<input name="stock" type="number" min={1} max={100} defaultValue={1} required/></label></div>{board.mediaEnabled?<label>PHOTO (OPTIONAL)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/></label>:<p className="helper">Photos are not available yet. You can still post without one.</p>}
      </>}
      {modal.kind==="edit_listing"&&<>
        <label>ITEM OR EXPERIENCE<input name="title" maxLength={100} defaultValue={modal.item!.title} required autoFocus/></label><label>WHAT'S INCLUDED<textarea name="description" maxLength={2000} defaultValue={modal.item!.description} required/></label>
        <div className="form-grid"><label>PRICE IN PP<input name="price" type="number" min={1} max={100000} defaultValue={modal.item!.price} required/></label><label>ADD STOCK<input name="addStock" type="number" min={0} max={100} defaultValue={0} required/></label></div>
        <p className="helper">{modal.item!.stock} currently available. Add up to 100 units. Price and description changes apply to future purchases; existing reservations keep their agreed price.</p>
      </>}
      {modal.kind==="story"&&<><p>{modal.item!.title}</p><label>WHAT HAPPENED?<textarea name="story" maxLength={2000} required autoFocus placeholder="Tell the reviewers what you did."/></label>{board.mediaEnabled?<label>PHOTO (OPTIONAL)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/></label>:<p className="helper">Photos are not available yet. You can still post without one.</p>}<p className="helper">Two other members are assigned randomly. Both must approve. You can still be verified after someone else wins the pot.</p></>}
      {modal.kind==="tip"&&<><label>FRIEND<select name="memberId" defaultValue={modal.item?.id} required>{board.leaderboard.filter(m=>m.id!==person.id).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>PP<input name="amount" type="number" min={1} max={Math.min(10000,person.balance)} required/></label><label>A NOTE (OPTIONAL)<input name="note" maxLength={200}/></label></>}
      {modal.kind==="rename"&&<><label>YOUR DISPLAY NAME<input name="name" defaultValue={person.name} maxLength={40} required autoFocus/></label><div className="account-danger"><p>Deleting your account signs you out and lets you go through onboarding again.</p><button type="button" disabled={busy} onClick={()=>{setError("");setModal({kind:"delete_account"});}}>DELETE MY ACCOUNT</button></div></>}
      {modal.kind==="delete_account"&&<><p>This removes your profile and this app’s Google sign-in account. Shared quest, purchase, and PP history stays under “Deleted member.” You can sign up again and answer the group questions; you won’t receive a second 100 PP starter grant.</p><p>Pending purchases, debt, and unresolved scheduled commitments must be settled first. Your unused PP and unclaimed quest pots are retired.</p><label>TYPE DELETE TO CONFIRM<input name="confirmation" required pattern="DELETE" autoComplete="off" autoFocus/></label></>}
      {modal.kind==="reject"&&<label>WHAT NEEDS TO CHANGE?<textarea name="note" maxLength={500} required autoFocus/></label>}
      {modal.kind==="buy"&&<><p><b>{modal.item!.title}</b> · {pp(modal.item!.price)}</p><p>This reserves the price now. Confirm receipt to release it to {modal.item!.owner_name}.</p></>}
      {modal.kind==="delete"&&<p>The quest will leave the board. Its history and reserved pot stay intact, and Kamrul can restore it.</p>}
      {modal.kind==="admin"&&<>
        {modal.op==="admin_reassign_review"&&<p>A different eligible member will be picked randomly. Existing approvals stay in place; the replacement must still review this completion.</p>}
        {["admin_adjust","admin_assign_legacy"].includes(modal.op!)&&<label>MEMBER<select name="memberId" required>{admin?.members.map((m:Row)=><option key={m.id} value={m.id}>{m.name} · {pp(m.balance)}</option>)}</select></label>}
        {modal.op==="admin_adjust"&&<label>PP CHANGE (NEGATIVE TO DEDUCT)<input name="amount" type="number" min={-10000} max={10000} required/></label>}
        <label>REASON<textarea name="reason" maxLength={500} required autoFocus/></label>
      </>}
      {error&&<p className="error-line" role="alert">{error}</p>}
      <button className="submit-button" disabled={busy}>{busy?"SAVING…":modal.kind==="quest"?"STAKE & POST":modal.kind==="buy"?"RESERVE "+pp(modal.item!.price):modal.kind==="delete_account"?"DELETE MY ACCOUNT":modal.kind==="rename"?"SAVE":"CONFIRM"} <ArrowUpRight size={18}/></button>
      </form>
    </Modal>}
  </main>;
}
