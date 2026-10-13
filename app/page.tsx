"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CircleDot,
  KeyRound,
  LockKeyhole,
  LogOut,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

type Quest = {
  id: number;
  title: string;
  createdBy: string;
  description: string;
  reward: string;
  points: number;
  category: string;
  status: "open" | "claimed" | "completed";
  claimedBy: string;
  createdAt: string;
  completedAt: string | null;
  participants: Participant[];
};

type Participant = {
  id: number;
  questId: number;
  name: string;
  status: "claimed" | "completed";
  createdAt: string;
  completedAt: string | null;
};

const categoryMeta: Record<string, { label: string; glyph: string }> = {
  move: { label: "MOVE", glyph: "动" },
  make: { label: "MAKE", glyph: "造" },
  wander: { label: "WANDER", glyph: "游" },
  connect: { label: "CONNECT", glyph: "聚" },
  learn: { label: "LEARN", glyph: "学" },
  misc: { label: "OTHER", glyph: "支" },
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "Something went sideways.");
  return body;
}

export default function Home() {
  const [locked, setLocked] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [quests, setQuests] = useState<Quest[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [identityReady, setIdentityReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"active" | "completed" | "all">("active");

  async function load() {
    try {
      const data = await api<{ quests: Quest[] }>("/api/quests");
      setQuests(data.quests);
      setLocked(false);
    } catch (err) {
      if (err instanceof Error && err.message === "locked") setLocked(true);
      else setError(err instanceof Error ? err.message : "Could not load quests.");
    }
  }

  useEffect(() => {
    setName(localStorage.getItem("side-quest-name") ?? "");
    setIdentityReady(true);
    load();
  }, []);

  const stats = useMemo(
    () => ({
      quests: quests.length,
      claimed: quests.reduce(
        (total, quest) => total + quest.participants.filter((person) => person.status === "claimed").length,
        0
      ),
      completed: quests.reduce(
        (total, quest) => total + quest.participants.filter((person) => person.status === "completed").length,
        0
      ),
      points: quests.reduce(
        (total, quest) =>
          total + quest.participants.filter((person) => person.status === "completed").length * quest.points,
        0
      ),
    }),
    [quests]
  );

  const visibleQuests = quests.filter((quest) => {
    const mine = quest.participants.find(
      (person) => person.name.toLowerCase() === name.toLowerCase()
    );
    if (filter === "active") return mine?.status !== "completed";
    if (filter === "completed") return mine?.status === "completed";
    return true;
  });

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
      setPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock the board.");
    } finally {
      setBusy(false);
    }
  }

  async function addQuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    try {
      const data = await api<{ quest: Quest }>("/api/quests", {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          createdBy: name,
          description: form.get("description"),
          reward: form.get("reward"),
          points: Number(form.get("points")),
          category: form.get("category"),
        }),
      });
      setQuests((current) => [data.quest, ...current]);
      setComposerOpen(false);
      formElement.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the quest.");
    } finally {
      setBusy(false);
    }
  }

  async function updateQuest(quest: Quest, action: string, actor = name) {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ quest: Quest }>("/api/quests", {
        method: "PATCH",
        body: JSON.stringify({ id: quest.id, action, name: actor }),
      });
      setQuests((current) => current.map((item) => (item.id === quest.id ? data.quest : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the quest.");
    } finally {
      setBusy(false);
    }
  }

  async function removeQuest(quest: Quest) {
    if (!window.confirm(`Remove “${quest.title}”?`)) return;
    try {
      await api("/api/quests", { method: "DELETE", body: JSON.stringify({ id: quest.id }) });
      setQuests((current) => current.filter((item) => item.id !== quest.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the quest.");
    }
  }

  function saveIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = nameDraft.trim().slice(0, 40);
    if (!cleanName) return;
    localStorage.setItem("side-quest-name", cleanName);
    setName(cleanName);
  }

  if (locked === null) {
    return <main className="loading-screen"><span className="loading-mark">支</span></main>;
  }

  if (locked) {
    return (
      <main className="gate-shell">
        <section className="gate-card">
          <div className="gate-orbit" aria-hidden="true"><span>支</span></div>
          <p className="eyebrow"><LockKeyhole size={13} /> PRIVATE FIELD NOTES · 私人档案</p>
          <h1 className="gate-title">
            <span>Life is the</span>
            <span>main quest.</span>
            <em>These make it interesting.</em>
          </h1>
          <p className="gate-copy">A shared ledger for tiny missions, strange ideas, and reasons to leave the house.</p>
          <form onSubmit={login} className="gate-form">
            <label htmlFor="password">ACCESS KEY</label>
            <div className="input-cluster">
              <KeyRound size={17} />
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter the shared key" autoFocus />
              <button disabled={busy || !password} aria-label="Unlock"><ArrowUpRight size={18} /></button>
            </div>
          </form>
          {error && <p className="error-line">{error}</p>}
          <footer><span>SEA · 2026</span><span>BUILD A LIFE OFFLINE</span></footer>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top"><span>支</span><div>SIDE QUEST<br />LEDGER</div></a>
        <div className="week-signal"><i /> LIVE BOARD <b>WEEK {getWeekNumber()}</b></div>
        <div className="user-controls">
          <button
            className="user-badge"
            title="Change your saved name"
            onClick={() => {
              localStorage.removeItem("side-quest-name");
              setNameDraft(name);
              setName("");
            }}
          ><UserRound size={14} /> {name || "SET NAME"}</button>
          <button className="icon-button" title="Lock board" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); setLocked(true); }}><LogOut size={16} /></button>
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow"><Sparkles size={13} /> OPTIONAL, BUT WORTH IT</p>
          <h1>Do something<br /><em>sideways.</em></h1>
        </div>
        <p className="hero-copy">Small departures from the default path.<br />Post one. Claim one. Come back with a story.</p>
      </section>

      <section className="stats-strip" aria-label="Board stats">
        <div><span>QUESTS</span><strong>{String(stats.quests).padStart(2, "0")}</strong></div>
        <div><span>IN MOTION</span><strong>{String(stats.claimed).padStart(2, "0")}</strong></div>
        <div><span>CLEARED</span><strong>{String(stats.completed).padStart(2, "0")}</strong></div>
        <div className="points"><span>FIELD SCORE</span><strong>{stats.points}<small> XP</small></strong></div>
      </section>

      <section className="board-controls">
        <div className="filter-tabs">
          {(["active", "completed", "all"] as const).map((tab) => (
            <button key={tab} className={filter === tab ? "active" : ""} onClick={() => setFilter(tab)}>{tab.toUpperCase()}</button>
          ))}
        </div>
        <button className="add-button" onClick={() => setComposerOpen(true)}><Plus size={17} /> ADD SIDE QUEST</button>
      </section>

      {error && <button className="toast" onClick={() => setError("")}><X size={15} /> {error}</button>}

      <section className="quest-grid">
        {visibleQuests.map((quest, index) => {
          const meta = categoryMeta[quest.category] ?? categoryMeta.misc;
          const mine = quest.participants.find(
            (person) => person.name.toLowerCase() === name.toLowerCase()
          );
          const cardState = mine?.status ?? (quest.participants.length ? "claimed" : "open");
          return (
            <article className={`quest-card ${cardState}`} key={quest.id} style={{ "--index": index } as React.CSSProperties}>
              <div className="card-topline"><span className="category"><b>{meta.glyph}</b>{meta.label}</span><span className="quest-id">SQ-{String(quest.id).padStart(3, "0")}</span></div>
              <div className="quest-copy"><h2>{quest.title}</h2><p className="quest-creator">{quest.createdBy ? `Added by ${quest.createdBy}` : "Creator not recorded"}</p>{quest.description && <p>{quest.description}</p>}</div>
              <div className="reward-row"><span><small>VALUE</small><b>{quest.reward || "A good story"}</b></span><span className="xp">+{quest.points} XP</span></div>
              <div className="participant-row">
                {quest.participants.length ? quest.participants.map((person) => (
                  <span className={`participant-chip ${person.status}`} key={`${person.id}-${person.name}`}>
                    {person.status === "completed" && <Check size={11} />}{person.name}
                  </span>
                )) : <span className="participant-empty">No takers yet</span>}
              </div>
              <div className="card-actions">
                {!mine && <button disabled={busy} onClick={() => updateQuest(quest, "claim")}><CircleDot size={15} /> TAKE QUEST</button>}
                {mine?.status === "claimed" && <button disabled={busy} onClick={() => updateQuest(quest, "complete")}><Check size={15} /> MARK COMPLETE</button>}
                {mine?.status === "completed" && <button disabled={busy} onClick={() => updateQuest(quest, "reopen")}><RotateCcw size={14} /> DO AGAIN</button>}
                {mine?.status === "claimed" && <button className="release" disabled={busy} onClick={() => updateQuest(quest, "unclaim")}><X size={13} /> LEAVE</button>}
                <button className="delete" onClick={() => removeQuest(quest)} title="Remove quest"><Trash2 size={14} /></button>
              </div>
              {mine?.status === "completed" && <div className="cleared-stamp">YOU DID IT<br /><b>已完成</b></div>}
            </article>
          );
        })}
        {visibleQuests.length === 0 && <button className="empty-card" onClick={() => setComposerOpen(true)}><Plus size={24} /><b>Nothing here yet.</b><span>Plant the first side quest.</span></button>}
      </section>

      <footer className="site-footer"><span>THE WEEK IS STILL OPEN.</span><span>少一点计划，多一点生活。</span></footer>

      {composerOpen && (
        <div className="modal-backdrop" onMouseDown={() => setComposerOpen(false)}>
          <form className="modal-card composer" onSubmit={addQuest} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span>NEW ENTRY</span><h2>Plant a side quest</h2></div><button type="button" onClick={() => setComposerOpen(false)}><X /></button></div>
            <label>QUEST NAME<input name="title" maxLength={100} placeholder="Find the city's best dumpling" autoFocus required /></label>
            <label>FIELD NOTES<textarea name="description" maxLength={400} placeholder="Rules, location, proof, or why this might be fun..." /></label>
            <div className="form-grid"><label>VALUE / REWARD<input name="reward" maxLength={100} placeholder="Dinner is on me" /></label><label>XP<input name="points" type="number" min="1" max="100" defaultValue="20" /></label></div>
            <label>CATEGORY<select name="category" defaultValue="wander">{Object.entries(categoryMeta).map(([value, meta]) => <option key={value} value={value}>{meta.glyph} · {meta.label}</option>)}</select></label>
            <button className="submit-button" disabled={busy}>PUBLISH TO THE BOARD <ArrowUpRight size={18} /></button>
          </form>
        </div>
      )}

      {identityReady && !name && (
        <div className="modal-backdrop">
          <form className="modal-card action-modal identity-modal" onSubmit={saveIdentity}>
            <span className="big-glyph">名</span>
            <p>ONE-TIME SETUP</p>
            <h2>What should we call you?</h2>
            <label>YOUR NAME<input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} maxLength={40} placeholder="Your name" autoFocus required /></label>
            <button className="submit-button">SAVE ON THIS DEVICE <ArrowUpRight size={18} /></button>
            <small>This stays in your browser so you won’t be asked for every quest.</small>
          </form>
        </div>
      )}
    </main>
  );
}

function getWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return String(Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)).padStart(2, "0");
}
