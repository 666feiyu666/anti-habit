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
