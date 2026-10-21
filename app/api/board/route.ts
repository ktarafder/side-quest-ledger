import { database, handle, member, mediaEnabled } from "../../../lib/server";
import { many, one } from "../../../lib/domain";
export async function GET(request: Request) {
  return handle(request,async ctx=>{
    const person=await member(ctx), db=database();
    const page=Math.max(0,Math.min(1000,Number(new URL(request.url).searchParams.get("archivePage"))||0));
    const [quests, attendance, leaderboard, listings, purchases, archive, reviews, wallet, legacy] = await Promise.all([
      many(db,"SELECT q.*,m.name AS owner_name FROM quests q LEFT JOIN members m ON m.id=q.owner_id WHERE q.deleted_at IS NULL ORDER BY q.id DESC LIMIT 200"),
      many(db,"SELECT a.*,m.name FROM attendance a JOIN members m ON m.id=a.member_id JOIN quests q ON q.id=a.quest_id WHERE q.deleted_at IS NULL ORDER BY a.created_at DESC LIMIT 1000"),
      many(db,"SELECT m.id,m.name,m.balance,(SELECT COUNT(*) FROM submissions s WHERE s.member_id=m.id AND s.status='approved') AS completed,(SELECT COUNT(*) FROM kudos k JOIN submissions s ON s.id=k.submission_id WHERE s.member_id=m.id AND s.status='approved') AS kudos FROM members m WHERE m.status='active' ORDER BY m.balance DESC,m.name LIMIT 200"),
      many(db,"SELECT l.*,m.name AS owner_name FROM listings l JOIN members m ON m.id=l.owner_id WHERE l.deleted_at IS NULL ORDER BY l.created_at DESC LIMIT 200"),
      many(db,"SELECT p.*,b.name AS buyer_name,s.name AS seller_name FROM purchases p JOIN members b ON b.id=p.buyer_id JOIN members s ON s.id=p.seller_id WHERE p.buyer_id=? OR p.seller_id=? ORDER BY p.created_at DESC LIMIT 200",person.id,person.id),
      many(db,"SELECT s.*,q.title,q.points,q.winner_submission_id,m.name,(SELECT COUNT(*) FROM kudos k WHERE k.submission_id=s.id) AS kudos,(SELECT COUNT(*) FROM kudos k WHERE k.submission_id=s.id AND k.member_id=?) AS my_kudos FROM submissions s JOIN quests q ON q.id=s.quest_id JOIN members m ON m.id=s.member_id WHERE s.status='approved' AND q.deleted_at IS NULL ORDER BY s.decided_at DESC,s.id DESC LIMIT 50 OFFSET ?",person.id,page*50),
      many(db,"SELECT r.*,s.story,s.asset_id,s.member_id,s.quest_id,s.created_at AS submitted_at,q.title,m.name,(SELECT COUNT(*) FROM reviews x WHERE x.submission_id=s.id AND x.decision='approve') AS approvals FROM reviews r JOIN submissions s ON s.id=r.submission_id JOIN quests q ON q.id=s.quest_id JOIN members m ON m.id=s.member_id WHERE r.reviewer_id=? AND r.decision='pending' AND s.status='pending' AND q.deleted_at IS NULL ORDER BY s.created_at LIMIT 100",person.id),
      many(db,"SELECT e.*,f.name AS from_name,t.name AS to_name FROM pp_events e LEFT JOIN members f ON f.id=e.from_id LEFT JOIN members t ON t.id=e.to_id WHERE e.from_id=? OR e.to_id=? ORDER BY e.rowid DESC LIMIT 100",person.id,person.id),
      many(db,"SELECT p.* FROM quest_participants p JOIN quests q ON q.id=p.quest_id WHERE q.deleted_at IS NULL ORDER BY p.id DESC LIMIT 500"),
    ]);
    const submissions=await many(db,"SELECT s.id,s.quest_id,s.member_id,s.status,s.story,s.asset_id,(SELECT COUNT(*) FROM reviews r WHERE r.submission_id=s.id) AS assigned,(SELECT COUNT(*) FROM reviews r WHERE r.submission_id=s.id AND r.decision='approve') AS approvals,(SELECT GROUP_CONCAT(note,'; ') FROM reviews r WHERE r.submission_id=s.id AND r.decision='reject') AS feedback FROM submissions s JOIN quests q ON q.id=s.quest_id WHERE q.deleted_at IS NULL ORDER BY s.created_at DESC LIMIT 500");
    const stats=await one(db,"SELECT (SELECT COUNT(*) FROM quests WHERE deleted_at IS NULL AND status='open') AS open,(SELECT COUNT(*) FROM submissions WHERE status='approved') AS completed,(SELECT COALESCE(SUM(balance),0) FROM members) AS circulation,(SELECT COUNT(*) FROM submissions WHERE status='pending') AS pending");
    return Response.json({member:person,quests,attendance,leaderboard,listings,purchases,archive,reviews,wallet,legacy,submissions,stats,archivePage:page,mediaEnabled:mediaEnabled()});
  });
}
