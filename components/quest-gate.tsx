import type { ReactNode } from "react";

function CompassSeal() {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="26"/><circle cx="32" cy="32" r="19" strokeDasharray="1 4"/><path d="m32 4 5 23 23 5-23 5-5 23-5-23-23-5 23-5Z"/><path d="m32 16 3 13 13 3-13 3-3 13-3-13-13-3 13-3Z" fill="currentColor"/><circle cx="32" cy="32" r="3" fill="var(--signup-bg)"/></svg>;
}

export default function QuestGate({children,enrolling=false}:{children:ReactNode;enrolling?:boolean}) {
  return <main className={"signup-page"+(enrolling?" signup-enrolling":"")}>
    <header className="signup-header">
      <a className="signup-brand" href="/" aria-label="Side Quest Ledger home"><CompassSeal/><span>SIDE QUEST<br/>LEDGER</span></a>
      <span className="signup-edition">A FRIENDS-ONLY FIELD GUIDE<span>SEA / EST. 2026</span></span>
      <span className="signup-header-note"><i/> REAL LIFE, GOOD COMPANY.</span>
    </header>
    <div className="signup-main">
      <section className="signup-intro" aria-labelledby="signup-title">
        <p className="signup-eyebrow"><span>01 /</span> GO A LITTLE OFF SCRIPT</p>
        <h1 id="signup-title">Take a<br/><em>side quest.</em></h1>
        <p className="signup-description">Small adventures. Unexpected plans.<br/>Better stories with your favorite people.</p>
        <div className="signup-controls">{children}</div>
      </section>
      <figure className="signup-art">
        <div className="signup-art-frame"><span className="art-cross art-cross-top" aria-hidden="true">+</span><span className="art-cross art-cross-bottom" aria-hidden="true">+</span><img src="/quest-engraving.jpg" width="1254" height="1254" alt="An engraved compass guides two friends up winding steps toward a mountain framed by a celestial doorway." fetchPriority="high" decoding="async"/></div>
        <figcaption><span>FIG. 01 — THE SCENIC ROUTE</span><span>THERE IS MORE OUT THERE ↗</span></figcaption>
      </figure>
    </div>
    <footer className="signup-footer">
      <p>BUILD A LIFE <em>OFFLINE.</em></p>
      <div className="signup-promises"><span><b>↗</b> FIND YOUR NEXT QUEST</span><span><b>✳</b> EARN POWER POINTS</span><span><b>◎</b> KEEP THE GOOD STORIES</span></div>
      <span className="signup-footer-mark" aria-hidden="true">支 / 侧线</span>
    </footer>
  </main>;
}
