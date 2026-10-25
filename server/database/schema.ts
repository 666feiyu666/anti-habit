import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
})

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
  },
  table => [
    uniqueIndex('daily_entries_goal_id_entry_date_unique').on(table.goalId, table.entryDate),
    check('daily_entries_status_check', sql`${table.status} in ('completed', 'missed')`),
  ],
)

export type GoalRow = typeof goals.$inferSelect
export type NewGoalRow = typeof goals.$inferInsert
export type DailyEntryRow = typeof dailyEntries.$inferSelect
export type NewDailyEntryRow = typeof dailyEntries.$inferInsert
