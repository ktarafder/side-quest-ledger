import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const quests = sqliteTable("quests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  createdBy: text("created_by").notNull().default(""),
  description: text("description").notNull().default(""),
  reward: text("reward").notNull().default(""),
  points: integer("points").notNull().default(10),
  category: text("category").notNull().default("misc"),
  status: text("status").notNull().default("open"),
  claimedBy: text("claimed_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
  ownerId: text("owner_id"),
  funded: integer("funded").notNull().default(0),
  winnerSubmissionId: text("winner_submission_id"),
  eventAt: text("event_at"),
  deletedAt: text("deleted_at"),
  requestKey: text("request_key").unique(),
  revision: integer("revision").notNull().default(0),
});

export const questParticipants = sqliteTable(
  "quest_participants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    questId: integer("quest_id")
      .notNull()
      .references(() => quests.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("claimed"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
  },
  (table) => [uniqueIndex("quest_participants_quest_name").on(table.questId, table.name)]
);

export const members = sqliteTable("members", {
  id: text("id").primaryKey(), authId: text("auth_id").notNull().unique(),
  email: text("email").notNull().unique(), name: text("name").notNull(),
  role: text("role").notNull().default("member"), status: text("status").notNull().default("active"),
  balance: integer("balance").notNull().default(0), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const commands = sqliteTable("commands", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull(), digest: text("digest").notNull(),
  response: text("response").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const operationChecks = sqliteTable("operation_checks", { ok: integer("ok").notNull() });
export const ppEvents = sqliteTable("pp_events", {
  id: text("id").primaryKey(), kind: text("kind").notNull(), actorId: text("actor_id").notNull(),
  fromId: text("from_id").references(() => members.id), toId: text("to_id").references(() => members.id),
  amount: integer("amount").notNull(), questId: integer("quest_id").references(() => quests.id),
  purchaseId: text("purchase_id"), reason: text("reason").notNull().default(""),
  reversesId: text("reverses_id").unique(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey(), questId: integer("quest_id").notNull().references(() => quests.id),
  memberId: text("member_id").notNull().references(() => members.id),
  status: text("status").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, t => [uniqueIndex("attendance_member_quest").on(t.questId, t.memberId)]);
export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(), questId: integer("quest_id").notNull().references(() => quests.id),
  memberId: text("member_id").notNull().references(() => members.id),
  story: text("story").notNull(), assetId: text("asset_id"),
  status: text("status").notNull().default("pending"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  decidedAt: text("decided_at"),
});
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(), submissionId: text("submission_id").notNull().references(() => submissions.id),
  reviewerId: text("reviewer_id").notNull().references(() => members.id),
  decision: text("decision").notNull().default("pending"), note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), decidedAt: text("decided_at"),
}, t => [uniqueIndex("review_distinct_member").on(t.submissionId, t.reviewerId)]);
export const kudos = sqliteTable("kudos", {
  id: text("id").primaryKey(), submissionId: text("submission_id").notNull().references(() => submissions.id),
  memberId: text("member_id").notNull().references(() => members.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, t => [uniqueIndex("one_kudos_per_member").on(t.submissionId, t.memberId)]);
export const listings = sqliteTable("listings", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull().references(() => members.id),
  title: text("title").notNull(), description: text("description").notNull(),
  price: integer("price").notNull(), stock: integer("stock").notNull().default(1),
  assetId: text("asset_id"), deletedAt: text("deleted_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  revision: integer("revision").notNull().default(0),
});
export const purchases = sqliteTable("purchases", {
  id: text("id").primaryKey(), listingId: text("listing_id").notNull().references(() => listings.id),
  buyerId: text("buyer_id").notNull().references(() => members.id), sellerId: text("seller_id").notNull().references(() => members.id),
  title: text("title").notNull(), price: integer("price").notNull(),
  status: text("status").notNull().default("pending"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull().references(() => members.id),
  size: integer("size").notNull(), contentType: text("content_type").notNull(), status: text("status").notNull().default("reserved"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const quizChallenges = sqliteTable("quiz_challenges", {
  id: text("id").primaryKey(), authId: text("auth_id").notNull(), questionIds: text("question_ids").notNull(),
  expiresAt: integer("expires_at").notNull(), attempts: integer("attempts").notNull().default(0), used: integer("used").notNull().default(0),
});
export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey(), count: integer("count").notNull(), expiresAt: integer("expires_at").notNull(),
});
export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull(), action: text("action").notNull(),
  targetId: text("target_id").notNull(), reason: text("reason").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const accountDeletions = sqliteTable("account_deletions", {
  authId: text("auth_id").primaryKey(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const welcomeClaims = sqliteTable("welcome_claims", {
  fingerprint: text("fingerprint").primaryKey(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
