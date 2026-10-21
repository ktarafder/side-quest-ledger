import { database, handle, member, admin } from "../../../lib/server";
import { many,one } from "../../../lib/domain";
export async function GET(request: Request) {
  return handle(request,async ctx=>{
    const person=await member(ctx); admin(person); const db=database();
    const before=Number(new URL(request.url).searchParams.get("before"))||Number.MAX_SAFE_INTEGER;
    const [metrics,events,purchases,members,deletedQuests,deletedListings,noShows,pending,audit,legacy,pendingReviewers] = await Promise.all([
      one(db,"SELECT (SELECT COALESCE(SUM(balance),0) FROM members) AS circulation,(SELECT COALESCE(SUM(-balance),0) FROM members WHERE balance<0) AS debt,(SELECT COALESCE(SUM(points),0) FROM quests WHERE funded=1 AND winner_submission_id IS NULL) AS quest_escrow,(SELECT COALESCE(SUM(price),0) FROM purchases WHERE status IN('pending','ready')) AS purchase_escrow,(SELECT COALESCE(SUM(amount),0) FROM pp_events WHERE kind='welcome') AS starter_issued,(SELECT COUNT(*) FROM purchases) AS purchases,(SELECT COUNT(*) FROM members) AS members,(SELECT COALESCE(SUM(size),0) FROM assets) AS storage_bytes"),
      many(db,"SELECT e.rowid AS seq,e.*,f.name AS from_name,t.name AS to_name,(SELECT COUNT(*) FROM pp_events r WHERE r.reverses_id=e.id) AS reversed FROM pp_events e LEFT JOIN members f ON f.id=e.from_id LEFT JOIN members t ON t.id=e.to_id WHERE e.rowid<? ORDER BY e.rowid DESC LIMIT 100",before),
      many(db,"SELECT p.*,b.name AS buyer_name,s.name AS seller_name FROM purchases p JOIN members b ON b.id=p.buyer_id JOIN members s ON s.id=p.seller_id ORDER BY p.created_at DESC LIMIT 200"),
      many(db,"SELECT * FROM members ORDER BY name LIMIT 200"),
      many(db,"SELECT * FROM quests WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200"),
      many(db,"SELECT * FROM listings WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200"),
      many(db,"SELECT a.*,m.name,q.title,q.event_at FROM attendance a JOIN members m ON m.id=a.member_id JOIN quests q ON q.id=a.quest_id WHERE a.status='reported' ORDER BY q.event_at LIMIT 200"),
      many(db,"SELECT s.*,q.title,m.name,(SELECT COUNT(*) FROM reviews r WHERE r.submission_id=s.id) AS assigned,(SELECT COUNT(*) FROM reviews r WHERE r.submission_id=s.id AND r.decision='approve') AS approvals FROM submissions s JOIN quests q ON q.id=s.quest_id JOIN members m ON m.id=s.member_id WHERE s.status='pending' AND q.deleted_at IS NULL ORDER BY s.created_at LIMIT 200"),
      many(db,"SELECT a.*,m.name FROM audit_events a LEFT JOIN members m ON m.id=a.actor_id ORDER BY a.rowid DESC LIMIT 100"),
      many(db,"SELECT id,title,created_by FROM quests WHERE owner_id IS NULL ORDER BY id DESC LIMIT 200"),
      many(db,"SELECT r.id,r.submission_id,r.created_at,m.name FROM reviews r JOIN submissions s ON s.id=r.submission_id JOIN quests q ON q.id=s.quest_id JOIN members m ON m.id=r.reviewer_id WHERE r.decision='pending' AND s.status='pending' AND q.deleted_at IS NULL ORDER BY r.created_at LIMIT 400"),
    ]);
    return Response.json({metrics,events,purchases,members,deletedQuests,deletedListings,noShows,pending,audit,legacy,pendingReviewers});
  });
}
