import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  essayTitle: text('essay_title'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
})

export const goalTargets = sqliteTable(
  'goal_targets',
  {
    id: text('id').primaryKey(),
    goalId: text('goal_id')
      .notNull()
      .references(() => goals.id),
    type: text('type', { enum: ['streak', 'cumulative'] }).notNull(),
    count: integer('count').notNull(),
    reward: text('reward'),
    rewardClaimedAt: integer('reward_claimed_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  table => [
    index('goal_targets_goal_id_idx').on(table.goalId),
    check('goal_targets_type_check', sql`${table.type} in ('streak', 'cumulative')`),
    check('goal_targets_count_check', sql`${table.count} > 0`),
  ],
)

export const dailyEntries = sqliteTable(
  'daily_entries',
  {
    id: text('id').primaryKey(),
    goalId: text('goal_id')
      .notNull()
      .references(() => goals.id),
    entryDate: text('entry_date').notNull(),
    status: text('status', { enum: ['completed', 'missed'] }).notNull(),
    reflection: text('reflection'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  table => [
    uniqueIndex('daily_entries_goal_id_entry_date_unique').on(table.goalId, table.entryDate),
    check('daily_entries_status_check', sql`${table.status} in ('completed', 'missed')`),
  ],
)

export const goalMaterials = sqliteTable(
  'goal_materials',
  {
    id: text('id').primaryKey(),
    goalId: text('goal_id')
      .notNull()
      .references(() => goals.id),
    title: text('title').notNull(),
    content: text('content').notNull(),
    sourceName: text('source_name'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  table => [
    index('goal_materials_goal_id_idx').on(table.goalId),
    check('goal_materials_title_check', sql`length(trim(${table.title})) > 0`),
  ],
)

export const entryLinks = sqliteTable(
  'entry_links',
  {
    sourceEntryId: text('source_entry_id')
      .notNull()
      .references(() => dailyEntries.id),
    targetEntryId: text('target_entry_id')
      .notNull()
      .references(() => dailyEntries.id),
    createdAt: integer('created_at').notNull(),
  },
  table => [
    primaryKey({ columns: [table.sourceEntryId, table.targetEntryId] }),
    index('entry_links_source_idx').on(table.sourceEntryId),
    index('entry_links_target_idx').on(table.targetEntryId),
    check('entry_links_not_self_check', sql`${table.sourceEntryId} <> ${table.targetEntryId}`),
  ],
)

export const memos = sqliteTable(
  'memos',
  {
    id: text('id').primaryKey(),
    content: text('content').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  table => [
    index('memos_created_at_idx').on(table.createdAt, table.id),
    index('memos_deleted_at_idx').on(table.deletedAt),
    check('memos_content_check', sql`length(trim(${table.content})) > 0`),
  ],
)

export const memoGoalLinks = sqliteTable(
  'memo_goal_links',
  {
    memoId: text('memo_id')
      .notNull()
      .references(() => memos.id),
    goalId: text('goal_id')
      .notNull()
      .references(() => goals.id),
    createdAt: integer('created_at').notNull(),
  },
  table => [
    primaryKey({ columns: [table.memoId, table.goalId] }),
    index('memo_goal_links_goal_id_idx').on(table.goalId),
  ],
)

export const memoEntryLinks = sqliteTable(
  'memo_entry_links',
  {
    memoId: text('memo_id')
      .notNull()
      .references(() => memos.id),
    entryId: text('entry_id')
      .notNull()
      .references(() => dailyEntries.id),
    createdAt: integer('created_at').notNull(),
  },
  table => [
    primaryKey({ columns: [table.memoId, table.entryId] }),
    index('memo_entry_links_entry_id_idx').on(table.entryId),
  ],
)

export type GoalRow = typeof goals.$inferSelect
export type NewGoalRow = typeof goals.$inferInsert
export type DailyEntryRow = typeof dailyEntries.$inferSelect
export type NewDailyEntryRow = typeof dailyEntries.$inferInsert
export type EntryLinkRow = typeof entryLinks.$inferSelect
export type NewEntryLinkRow = typeof entryLinks.$inferInsert
export type GoalMaterialRow = typeof goalMaterials.$inferSelect
export type NewGoalMaterialRow = typeof goalMaterials.$inferInsert
export type GoalTargetRow = typeof goalTargets.$inferSelect
export type NewGoalTargetRow = typeof goalTargets.$inferInsert
export type MemoRow = typeof memos.$inferSelect
export type NewMemoRow = typeof memos.$inferInsert
export type MemoGoalLinkRow = typeof memoGoalLinks.$inferSelect
export type MemoEntryLinkRow = typeof memoEntryLinks.$inferSelect
