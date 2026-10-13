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
