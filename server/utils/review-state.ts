import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { ReviewAction, ReviewSourceType } from '~~/shared/types'
import { dailyEntries, memos, reviewStates, type ReviewStateRow } from '../database/schema'
import type { AppDatabase } from './db'
import { apiError } from './http'

export interface ReviewSource {
  type: ReviewSourceType
  id: string
}

export const REVIEW_DAY_SECONDS = 86_400
export const REVIEW_INITIAL_DELAY_SECONDS = 7 * REVIEW_DAY_SECONDS
export const REVIEW_READ_INTERVAL_SECONDS = 21 * REVIEW_DAY_SECONDS
export const REVIEW_LATER_DELAY_SECONDS = 7 * REVIEW_DAY_SECONDS

export function requireReviewSource(db: AppDatabase, source: ReviewSource): void {
  if (!source.id) {
    throw apiError(404, 'REVIEW_SOURCE_NOT_FOUND', '回看内容不存在或已被删除')
  }

  if (source.type === 'memo') {
    const [row] = db
      .select({ id: memos.id, deletedAt: memos.deletedAt })
      .from(memos)
      .where(eq(memos.id, source.id))
      .limit(1)
      .all()

    if (!row || row.deletedAt !== null) {
      throw apiError(404, 'REVIEW_SOURCE_NOT_FOUND', '回看内容不存在或已被删除')
    }
    return
  }

  const [row] = db
    .select({
      id: dailyEntries.id,
      deletedAt: dailyEntries.deletedAt,
      reflection: dailyEntries.reflection,
    })
    .from(dailyEntries)
    .where(eq(dailyEntries.id, source.id))
    .limit(1)
    .all()

  if (!row || row.deletedAt !== null || !row.reflection?.trim()) {
    throw apiError(404, 'REVIEW_SOURCE_NOT_FOUND', '回看内容不存在或已被删除')
  }
}

export function findReviewState(
  db: AppDatabase,
  source: ReviewSource,
): ReviewStateRow | null {
  const condition = source.type === 'memo'
    ? eq(reviewStates.memoId, source.id)
    : eq(reviewStates.entryId, source.id)

  const [row] = db
    .select()
    .from(reviewStates)
    .where(condition)
    .limit(1)
    .all()

  return row ?? null
}

function writeState(
  db: AppDatabase,
  source: ReviewSource,
  values: {
    lastReviewedAt: number | null
    nextReviewAt: number | null
    dismissedAt: number | null
  },
  now: number,
): ReviewStateRow {
  const existing = findReviewState(db, source)

  if (existing) {
    db.update(reviewStates)
      .set({ ...values, updatedAt: now })
      .where(eq(reviewStates.id, existing.id))
      .run()

    return findReviewState(db, source)!
  }

  db.insert(reviewStates)
    .values({
      id: randomUUID(),
      memoId: source.type === 'memo' ? source.id : null,
      entryId: source.type === 'entry' ? source.id : null,
      lastReviewedAt: values.lastReviewedAt,
      nextReviewAt: values.nextReviewAt,
      dismissedAt: values.dismissedAt,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  return findReviewState(db, source)!
}

/** 回应一条旧记录时，视为已经读过。 */
export function markReviewRead(
  db: AppDatabase,
  source: ReviewSource,
  now = Math.floor(Date.now() / 1000),
): ReviewStateRow {
  requireReviewSource(db, source)

  return writeState(db, source, {
    lastReviewedAt: now,
    nextReviewAt: now + REVIEW_READ_INTERVAL_SECONDS,
    dismissedAt: null,
  }, now)
}

export function applyReviewAction(
  db: AppDatabase,
  source: ReviewSource,
  action: ReviewAction,
  now = Math.floor(Date.now() / 1000),
): ReviewStateRow {
  requireReviewSource(db, source)
  const existing = findReviewState(db, source)

  if (action === 'read') {
    return writeState(db, source, {
      lastReviewedAt: now,
      nextReviewAt: now + REVIEW_READ_INTERVAL_SECONDS,
      dismissedAt: null,
    }, now)
  }

  if (action === 'later') {
    return writeState(db, source, {
      lastReviewedAt: existing?.lastReviewedAt ?? null,
      nextReviewAt: now + REVIEW_LATER_DELAY_SECONDS,
      dismissedAt: null,
    }, now)
  }

  return writeState(db, source, {
    lastReviewedAt: existing?.lastReviewedAt ?? null,
    nextReviewAt: null,
    dismissedAt: now,
  }, now)
}
