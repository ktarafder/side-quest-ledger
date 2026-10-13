import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { questParticipants, quests } from "../../../db/schema";
import { isAuthorized } from "../../../lib/auth";

const categories = new Set(["move", "make", "wander", "connect", "learn", "misc"]);
const actions = new Set(["claim", "unclaim", "complete", "reopen"]);

async function guard(request: Request) {
  return (await isAuthorized(request))
    ? null
    : Response.json({ error: "locked" }, { status: 401 });
}

type QuestRow = typeof quests.$inferSelect;
type ParticipantRow = typeof questParticipants.$inferSelect;

function attachParticipants(quest: QuestRow, rows: ParticipantRow[]) {
  const participants = rows.filter((participant) => participant.questId === quest.id);
  if (
    quest.claimedBy &&
    !participants.some((participant) => participant.name.toLowerCase() === quest.claimedBy.toLowerCase())
  ) {
    participants.push({
      id: -quest.id,
      questId: quest.id,
      name: quest.claimedBy,
      status: quest.status === "completed" ? "completed" : "claimed",
      createdAt: quest.createdAt,
      completedAt: quest.completedAt,
    });
  }
  return { ...quest, participants };
}

async function getQuest(id: number) {
  const db = getDb();
  const [quest] = await db.select().from(quests).where(eq(quests.id, id)).limit(1);
  if (!quest) return null;
  const participants = await db
    .select()
    .from(questParticipants)
    .where(eq(questParticipants.questId, id));
  return attachParticipants(quest, participants);
}

export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;

  const db = getDb();
  const rows = await db.select().from(quests).orderBy(desc(quests.createdAt), desc(quests.id));
  const participants = await db.select().from(questParticipants);
  return Response.json(
    { quests: rows.map((quest) => attachParticipants(quest, participants)) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;

  const body = (await request.json()) as {
    title?: string;
    createdBy?: string;
    description?: string;
    reward?: string;
    points?: number;
    category?: string;
  };
  const title = body.title?.trim().slice(0, 100) ?? "";
  const createdBy = body.createdBy?.trim().slice(0, 40) ?? "";
  if (!title) return Response.json({ error: "Give the quest a name." }, { status: 400 });
  if (!createdBy) return Response.json({ error: "Add your name first." }, { status: 400 });

  const [quest] = await getDb()
    .insert(quests)
    .values({
      title,
      createdBy,
      description: body.description?.trim().slice(0, 400) ?? "",
      reward: body.reward?.trim().slice(0, 100) ?? "",
      points: Math.min(100, Math.max(1, Number(body.points) || 10)),
      category: categories.has(body.category ?? "") ? body.category! : "misc",
    })
    .returning();

  return Response.json({ quest: { ...quest, participants: [] } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;

  const body = (await request.json()) as { id?: number; action?: string; name?: string };
  const id = Number(body.id);
  const action = body.action ?? "";
  const name = body.name?.trim().slice(0, 40) ?? "";
  if (!Number.isInteger(id) || !actions.has(action)) {
    return Response.json({ error: "Invalid quest update." }, { status: 400 });
  }
  if (!name) {
    return Response.json({ error: "Add your name first." }, { status: 400 });
  }

  const db = getDb();
  const [quest] = await db.select().from(quests).where(eq(quests.id, id)).limit(1);
  if (!quest) return Response.json({ error: "Quest not found." }, { status: 404 });

  const [existing] = await db
    .select()
    .from(questParticipants)
    .where(and(eq(questParticipants.questId, id), eq(questParticipants.name, name)))
    .limit(1);

  if (action === "unclaim") {
    if (existing) {
      await db.delete(questParticipants).where(eq(questParticipants.id, existing.id));
    }
  } else {
    const status = action === "complete" ? "completed" : "claimed";
    const completedAt = status === "completed" ? new Date().toISOString() : null;
    if (existing) {
      await db
        .update(questParticipants)
        .set({ status, completedAt })
        .where(eq(questParticipants.id, existing.id));
    } else {
      await db.insert(questParticipants).values({ questId: id, name, status, completedAt });
    }
  }

  if (quest.claimedBy.toLowerCase() === name.toLowerCase()) {
    await db
      .update(quests)
      .set({ status: "open", claimedBy: "", completedAt: null })
      .where(eq(quests.id, id));
  }

  return Response.json({ quest: await getQuest(id) });
}

export async function DELETE(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;

  const body = (await request.json()) as { id?: number };
  const id = Number(body.id);
  if (!Number.isInteger(id)) return Response.json({ error: "Invalid quest." }, { status: 400 });
  const db = getDb();
  await db.delete(questParticipants).where(eq(questParticipants.questId, id));
  await db.delete(quests).where(eq(quests.id, id));
  return Response.json({ ok: true });
}
