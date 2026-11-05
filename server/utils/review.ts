import { eq, sql } from 'drizzle-orm'
import type {
  Memo,
  ReviewItem,
  ReviewPage,
  ReviewReflectionItem,
} from '~~/shared/types'
import { dailyEntries, goals } from '../database/schema'
import type { AppDatabase } from './db'
import { apiError } from './http'
import { getMemosByIds, loadEntryReplies } from './memos'
import {
  findReviewState,
  REVIEW_INITIAL_DELAY_SECONDS,
} from './review-state'

export interface ReviewListOptions {
  limit: number
  cursor?: string
}

interface ReviewCursorPayload {
  nextReviewAt: number
  createdAt: number
  id: string
  kind: 'memo' | 'daily_reflection'
}

interface ReviewRow {
  kind: 'memo' | 'daily_reflection'
  id: string
  content: string | null
  created_at: number
  updated_at: number
  entry_date: string | null
  goal_id: string | null
  goal_title: string | null
  goal_deleted_at: number | null
  next_review_at: number
  last_reviewed_at: number | null
  review_reason: 'first' | 'due'
}

function encodeCursor(payload: ReviewCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeCursor(value: string): ReviewCursorPayload {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<ReviewCursorPayload>

    if (
      typeof parsed.nextReviewAt !== 'number'
      || !Number.isFinite(parsed.nextReviewAt)
      || typeof parsed.createdAt !== 'number'
      || !Number.isFinite(parsed.createdAt)
      || typeof parsed.id !== 'string'
      || parsed.id.length === 0
      || (parsed.kind !== 'memo' && parsed.kind !== 'daily_reflection')
    ) {
      throw new Error('bad cursor')
    }

    return {
      nextReviewAt: parsed.nextReviewAt,
      createdAt: parsed.createdAt,
      id: parsed.id,
      kind: parsed.kind,
    }
  } catch {
    throw apiError(400, 'INVALID_CURSOR', '分页游标无效')
  }
}

function memoReviewItem(
  memo: Memo,
  state: ReturnType<typeof findReviewState>,
): ReviewItem {
  return {
    ...memo,
    kind: 'memo',
    sourceType: 'memo',
    nextReviewAt: state?.nextReviewAt
      ?? memo.createdAt + REVIEW_INITIAL_DELAY_SECONDS,
    lastReviewedAt: state?.lastReviewedAt ?? null,
    reviewReason: state ? 'due' : 'first',
  }
}

export function listReview(
  db: AppDatabase,
  options: ReviewListOptions,
): ReviewPage {
  const now = Math.floor(Date.now() / 1000)
  const cursor = options.cursor ? decodeCursor(options.cursor) : null

  const cursorCondition = cursor
    ? sql`and (
        next_review_at > ${cursor.nextReviewAt}
        or (
          next_review_at = ${cursor.nextReviewAt}
          and (
            created_at > ${cursor.createdAt}
            or (
              created_at = ${cursor.createdAt}
              and (
                id > ${cursor.id}
                or (id = ${cursor.id} and kind > ${cursor.kind})
              )
            )
          )
        )
      )`
    : sql``

  const rows = db.all<ReviewRow>(sql`
    select * from (
      select
        'memo' as kind,
        m.id as id,
        m.content as content,
        m.created_at as created_at,
        m.updated_at as updated_at,
        null as entry_date,
        null as goal_id,
        null as goal_title,
        null as goal_deleted_at,
        coalesce(s.next_review_at, m.created_at + ${REVIEW_INITIAL_DELAY_SECONDS}) as next_review_at,
        s.last_reviewed_at as last_reviewed_at,
        s.dismissed_at as dismissed_at,
        case when s.id is null then 'first' else 'due' end as review_reason
      from memos m
      left join review_states s on s.memo_id = m.id
      where m.deleted_at is null
      union all
      select
        'daily_reflection' as kind,
        e.id as id,
        e.reflection as content,
        e.created_at as created_at,
        e.updated_at as updated_at,
        e.entry_date as entry_date,
        g.id as goal_id,
        g.title as goal_title,
        g.deleted_at as goal_deleted_at,
        coalesce(s.next_review_at, e.created_at + ${REVIEW_INITIAL_DELAY_SECONDS}) as next_review_at,
        s.last_reviewed_at as last_reviewed_at,
        s.dismissed_at as dismissed_at,
        case when s.id is null then 'first' else 'due' end as review_reason
      from daily_entries e
      join goals g on g.id = e.goal_id
      left join review_states s on s.entry_id = e.id
      where e.deleted_at is null
        and length(trim(coalesce(e.reflection, ''))) > 0
    ) candidates
    where dismissed_at is null
      and next_review_at <= ${now}
      ${cursorCondition}
    order by next_review_at asc, created_at asc, id asc, kind asc
    limit ${options.limit + 1}
  `)

  const hasMore = rows.length > options.limit
  const pageRows = hasMore ? rows.slice(0, options.limit) : rows

  const memoById = new Map(
    getMemosByIds(
      db,
      pageRows.filter(row => row.kind === 'memo').map(row => row.id),
    ).map(memo => [memo.id, memo]),
  )
  const repliesByEntry = loadEntryReplies(
    db,
    pageRows.filter(row => row.kind === 'daily_reflection').map(row => row.id),
  )

  const items: ReviewItem[] = []

  for (const row of pageRows) {
    if (row.kind === 'memo') {
      const memo = memoById.get(row.id)
      if (!memo) continue

      items.push({
        ...memo,
        kind: 'memo',
        sourceType: 'memo',
        nextReviewAt: row.next_review_at,
        lastReviewedAt: row.last_reviewed_at,
        reviewReason: row.review_reason,
      })
      continue
    }

    items.push({
      kind: 'daily_reflection',
      id: row.id,
      content: row.content ?? '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      entryDate: row.entry_date ?? '',
      goalId: row.goal_id ?? '',
      goalTitle: row.goal_title ?? '',
      goalDeletedAt: row.goal_deleted_at,
      replies: repliesByEntry.get(row.id) ?? [],
      sourceType: 'entry',
      nextReviewAt: row.next_review_at,
      lastReviewedAt: row.last_reviewed_at,
      reviewReason: row.review_reason,
    })
  }

  const last = pageRows[pageRows.length - 1]

  return {
    items,
    nextCursor: hasMore && last
      ? encodeCursor({
          nextReviewAt: last.next_review_at,
          createdAt: last.created_at,
          id: last.id,
          kind: last.kind,
        })
      : null,
  }
}

export function getReviewItem(
  db: AppDatabase,
  type: 'memo' | 'entry',
  id: string,
): ReviewItem | null {
  if (type === 'memo') {
    const memo = getMemosByIds(db, [id])[0]
    if (!memo) return null
    return memoReviewItem(memo, findReviewState(db, { type: 'memo', id }))
  }

  const [row] = db
    .select({
      id: dailyEntries.id,
      content: dailyEntries.reflection,
      createdAt: dailyEntries.createdAt,
      updatedAt: dailyEntries.updatedAt,
      entryDate: dailyEntries.entryDate,
      goalId: dailyEntries.goalId,
      goalTitle: goals.title,
      goalDeletedAt: goals.deletedAt,
      deletedAt: dailyEntries.deletedAt,
    })
    .from(dailyEntries)
    .innerJoin(goals, eq(goals.id, dailyEntries.goalId))
    .where(eq(dailyEntries.id, id))
    .limit(1)
    .all()

  if (!row || row.deletedAt !== null || !row.content?.trim()) return null

  const state = findReviewState(db, { type: 'entry', id })
  const replies = loadEntryReplies(db, [id]).get(id) ?? []

  const item: ReviewReflectionItem = {
    kind: 'daily_reflection',
    id: row.id,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    entryDate: row.entryDate,
    goalId: row.goalId,
    goalTitle: row.goalTitle,
    goalDeletedAt: row.goalDeletedAt,
    replies,
    sourceType: 'entry',
    nextReviewAt: state?.nextReviewAt
      ?? row.createdAt + REVIEW_INITIAL_DELAY_SECONDS,
    lastReviewedAt: state?.lastReviewedAt ?? null,
    reviewReason: state ? 'due' : 'first',
  }

  return item
}
