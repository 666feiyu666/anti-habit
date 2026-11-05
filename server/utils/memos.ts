import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm'
import type {
  DailyEntryWithLinks,
  FeedItem,
  FeedLinkedFilter,
  FeedPage,
  GoalRelatedMemos,
  Memo,
  MemoEntryRef,
  MemoGoalRef,
  MemoPage,
  MemoRelationRef,
} from '~~/shared/types'
import {
  dailyEntries,
  goals,
  memoEntryLinks,
  memoGoalLinks,
  memoRelations,
  memos,
  type MemoRow,
} from '../database/schema'
import type { AppDatabase } from './db'
import { attachLinkedEntryIds } from './essays'
import { apiError } from './http'
import { markReviewRead, requireReviewSource } from './review-state'

type Database = AppDatabase

interface CursorPayload {
  createdAt: number
  id: string
  kind?: FeedItem['kind']
}

export interface MemoListOptions {
  q?: string
  goalId?: string
  linked?: FeedLinkedFilter
  limit: number
  cursor?: string
}

export interface MemoWriteInput {
  content: string
  goalIds?: string[]
  entryIds?: string[]
  replyTo?: {
    type: 'memo' | 'entry'
    id: string
  }
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeCursor(value: string): CursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<CursorPayload>
    if (
      typeof parsed.createdAt !== 'number'
      || !Number.isFinite(parsed.createdAt)
      || typeof parsed.id !== 'string'
      || parsed.id.length === 0
      || (parsed.kind !== undefined && parsed.kind !== 'memo' && parsed.kind !== 'daily_reflection')
    ) {
      throw new Error('bad cursor')
    }
    return {
      createdAt: parsed.createdAt,
      id: parsed.id,
      ...(parsed.kind ? { kind: parsed.kind } : {}),
    }
  } catch {
    throw apiError(400, 'INVALID_CURSOR', '分页游标无效')
  }
}

function searchCondition(column: SQL | ReturnType<typeof sql>, q: string | undefined): SQL | null {
  if (!q) return null
  return sql`instr(lower(${column}), lower(${q})) > 0`
}

function memoLinkExists(goalId?: string): SQL {
  const goalFilter = goalId ? sql` and de.goal_id = ${goalId} and de.deleted_at is null` : sql``
  return sql`(
    exists (select 1 from memo_goal_links l where l.memo_id = m.id${goalId ? sql` and l.goal_id = ${goalId}` : sql``})
    or exists (
      select 1 from memo_entry_links el
      join daily_entries de on de.id = el.entry_id
      where el.memo_id = m.id and de.deleted_at is null${goalFilter}
    )
  )`
}

function linkedCondition(linked: FeedLinkedFilter, goalId?: string): SQL | null {
  if (linked === 'all') return null
  return linked === 'linked'
    ? memoLinkExists(goalId)
    : sql`not ${memoLinkExists(goalId)}`
}

function tableCursorCondition(
  payload: CursorPayload,
  createdAt: SQL,
  id: SQL,
  kind: FeedItem['kind'],
): SQL {
  if (!payload.kind) {
    return sql`(${createdAt} < ${payload.createdAt} or (${createdAt} = ${payload.createdAt} and ${id} < ${payload.id}))`
  }

  const beforeOrEqualId = kind === 'daily_reflection' && payload.kind === 'memo'
  const idOperator = beforeOrEqualId ? sql`<=` : sql`<`

  return sql`(
    ${createdAt} < ${payload.createdAt}
    or (${createdAt} = ${payload.createdAt} and ${id} ${idOperator} ${payload.id})
  )`
}

function memoCursorCondition(payload: CursorPayload): SQL {
  return tableCursorCondition(payload, sql`${memos.createdAt}`, sql`${memos.id}`, 'memo')
}

function feedCursorCondition(payload: CursorPayload, kind: FeedItem['kind']): SQL {
  return kind === 'memo'
    ? tableCursorCondition(payload, sql`m.created_at`, sql`m.id`, 'memo')
    : tableCursorCondition(payload, sql`e.created_at`, sql`e.id`, 'daily_reflection')
}

function relationRef(id: string, content: string, createdAt: number): MemoRelationRef {
  const plain = content.replace(/\s+/g, ' ').trim()
  return {
    id,
    excerpt: plain.length > 120 ? `${plain.slice(0, 120)}…` : plain,
    createdAt,
  }
}

function toMemo(
  row: MemoRow,
  goalRefs: MemoGoalRef[],
  entries: MemoEntryRef[],
  hiddenEntryIds: string[],
  outgoingMemos: MemoRelationRef[],
  incomingMemos: MemoRelationRef[],
): Memo {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    goals: goalRefs,
    entries,
    hiddenEntryIds,
    outgoingMemos,
    incomingMemos,
  }
}

export function loadMemoRelations(db: Database, memoIds: string[]) {
  const goalsByMemo = new Map<string, MemoGoalRef[]>()
  const entriesByMemo = new Map<string, MemoEntryRef[]>()
  const hiddenByMemo = new Map<string, string[]>()
  const outgoingByMemo = new Map<string, MemoRelationRef[]>()
  const incomingByMemo = new Map<string, MemoRelationRef[]>()

  if (memoIds.length === 0) {
    return {
      goalsByMemo,
      entriesByMemo,
      hiddenByMemo,
      outgoingByMemo,
      incomingByMemo,
    }
  }

  const goalRows = db
    .select({
      memoId: memoGoalLinks.memoId,
      id: goals.id,
      title: goals.title,
      deletedAt: goals.deletedAt,
    })
    .from(memoGoalLinks)
    .innerJoin(goals, eq(goals.id, memoGoalLinks.goalId))
    .where(inArray(memoGoalLinks.memoId, memoIds))
    .orderBy(asc(goals.createdAt), asc(goals.id))
    .all()

  for (const row of goalRows) {
    const list = goalsByMemo.get(row.memoId) ?? []
    list.push({ id: row.id, title: row.title, deletedAt: row.deletedAt })
    goalsByMemo.set(row.memoId, list)
  }

  const entryRows = db
    .select({
      memoId: memoEntryLinks.memoId,
      id: dailyEntries.id,
      entryDate: dailyEntries.entryDate,
      goalId: dailyEntries.goalId,
      goalTitle: goals.title,
      goalDeletedAt: goals.deletedAt,
      entryDeletedAt: dailyEntries.deletedAt,
    })
    .from(memoEntryLinks)
    .innerJoin(dailyEntries, eq(dailyEntries.id, memoEntryLinks.entryId))
    .innerJoin(goals, eq(goals.id, dailyEntries.goalId))
    .where(inArray(memoEntryLinks.memoId, memoIds))
    .orderBy(asc(dailyEntries.entryDate), asc(dailyEntries.id))
    .all()

  for (const row of entryRows) {
    if (row.entryDeletedAt !== null) {
      const hidden = hiddenByMemo.get(row.memoId) ?? []
      hidden.push(row.id)
      hiddenByMemo.set(row.memoId, hidden)
      continue
    }

    const list = entriesByMemo.get(row.memoId) ?? []
    list.push({
      id: row.id,
      entryDate: row.entryDate,
      goalId: row.goalId,
      goalTitle: row.goalTitle,
      goalDeletedAt: row.goalDeletedAt,
    })
    entriesByMemo.set(row.memoId, list)
  }

  const outgoingRows = db
    .select({
      ownerId: memoRelations.sourceMemoId,
      id: memos.id,
      content: memos.content,
      createdAt: memos.createdAt,
    })
    .from(memoRelations)
    .innerJoin(memos, eq(memos.id, memoRelations.targetMemoId))
    .where(and(
      inArray(memoRelations.sourceMemoId, memoIds),
      isNull(memos.deletedAt),
    ))
    .orderBy(asc(memoRelations.createdAt), asc(memos.id))
    .all()

  for (const row of outgoingRows) {
    const list = outgoingByMemo.get(row.ownerId) ?? []
    list.push(relationRef(row.id, row.content, row.createdAt))
    outgoingByMemo.set(row.ownerId, list)
  }

  const incomingRows = db
    .select({
      ownerId: memoRelations.targetMemoId,
      id: memos.id,
      content: memos.content,
      createdAt: memos.createdAt,
    })
    .from(memoRelations)
    .innerJoin(memos, eq(memos.id, memoRelations.sourceMemoId))
    .where(and(
      inArray(memoRelations.targetMemoId, memoIds),
      isNull(memos.deletedAt),
    ))
    .orderBy(asc(memoRelations.createdAt), asc(memos.id))
    .all()

  for (const row of incomingRows) {
    const list = incomingByMemo.get(row.ownerId) ?? []
    list.push(relationRef(row.id, row.content, row.createdAt))
    incomingByMemo.set(row.ownerId, list)
  }

  return {
    goalsByMemo,
    entriesByMemo,
    hiddenByMemo,
    outgoingByMemo,
    incomingByMemo,
  }
}

/** 打卡反思后来收到的笔记回应。 */
export function loadEntryReplies(
  db: Database,
  entryIds: string[],
): Map<string, MemoRelationRef[]> {
  const repliesByEntry = new Map<string, MemoRelationRef[]>()
  if (entryIds.length === 0) return repliesByEntry

  const rows = db
    .select({
      entryId: memoEntryLinks.entryId,
      id: memos.id,
      content: memos.content,
      createdAt: memos.createdAt,
    })
    .from(memoEntryLinks)
    .innerJoin(memos, eq(memos.id, memoEntryLinks.memoId))
    .where(and(
      inArray(memoEntryLinks.entryId, entryIds),
      isNull(memos.deletedAt),
    ))
    .orderBy(asc(memoEntryLinks.createdAt), asc(memos.id))
    .all()

  for (const row of rows) {
    const list = repliesByEntry.get(row.entryId) ?? []
    list.push(relationRef(row.id, row.content, row.createdAt))
    repliesByEntry.set(row.entryId, list)
  }

  return repliesByEntry
}

function buildMemos(db: Database, rows: MemoRow[]): Memo[] {
  const {
    goalsByMemo,
    entriesByMemo,
    hiddenByMemo,
    outgoingByMemo,
    incomingByMemo,
  } = loadMemoRelations(db, rows.map(row => row.id))

  return rows.map(row => toMemo(
    row,
    goalsByMemo.get(row.id) ?? [],
    entriesByMemo.get(row.id) ?? [],
    hiddenByMemo.get(row.id) ?? [],
    outgoingByMemo.get(row.id) ?? [],
    incomingByMemo.get(row.id) ?? [],
  ))
}

export function getMemosByIds(db: Database, ids: string[]): Memo[] {
  if (ids.length === 0) return []

  const rows = db
    .select()
    .from(memos)
    .where(and(
      inArray(memos.id, ids),
      isNull(memos.deletedAt),
    ))
    .all()

  return buildMemos(db, rows)
}

export function listMemos(db: Database, options: MemoListOptions): MemoPage {
  const conditions: SQL[] = [sql`${memos.deletedAt} is null`]

  const search = searchCondition(sql`${memos.content}`, options.q)
  if (search) conditions.push(search)

  const linked = linkedCondition(options.linked ?? 'all', options.goalId)
  if (linked) conditions.push(linked)

  if (options.goalId) conditions.push(memoLinkExists(options.goalId))

  if (options.cursor) {
    conditions.push(memoCursorCondition(decodeCursor(options.cursor)))
  }

  const rows = db
    .select()
    .from(memos)
    .where(and(...conditions))
    .orderBy(desc(memos.createdAt), desc(memos.id))
    .limit(options.limit + 1)
    .all()

  const hasMore = rows.length > options.limit
  const pageRows = hasMore ? rows.slice(0, options.limit) : rows
  const last = pageRows[pageRows.length - 1]

  return {
    memos: buildMemos(db, pageRows),
    nextCursor: hasMore && last
      ? encodeCursor({ createdAt: last.createdAt, id: last.id })
      : null,
  }
}

interface FeedRow {
  kind: FeedItem['kind']
  id: string
  content: string | null
  created_at: number
  updated_at: number
  entry_date: string | null
  goal_id: string | null
  goal_title: string | null
  goal_deleted_at: number | null
}

export function listFeed(db: Database, options: MemoListOptions): FeedPage {
  const memoConditions: SQL[] = [sql`m.deleted_at is null`]
  const reflectionConditions: SQL[] = [
    sql`e.deleted_at is null`,
    sql`length(trim(coalesce(e.reflection, ''))) > 0`,
  ]

  const memoSearch = searchCondition(sql`m.content`, options.q)
  if (memoSearch) memoConditions.push(memoSearch)

  const reflectionSearch = searchCondition(sql`e.reflection`, options.q)
  if (reflectionSearch) reflectionConditions.push(reflectionSearch)

  const memoLinked = linkedCondition(options.linked ?? 'all', options.goalId)
  if (memoLinked) memoConditions.push(memoLinked)

  if (options.goalId) {
    memoConditions.push(memoLinkExists(options.goalId))
    reflectionConditions.push(sql`e.goal_id = ${options.goalId}`)
  }

  if ((options.linked ?? 'all') === 'unlinked') {
    reflectionConditions.push(sql`0 = 1`)
  }

  let cursor: CursorPayload | null = null
  if (options.cursor) {
    cursor = decodeCursor(options.cursor)
    memoConditions.push(feedCursorCondition(cursor, 'memo'))
    reflectionConditions.push(feedCursorCondition(cursor, 'daily_reflection'))
  }

  const rows = db.all<FeedRow>(sql`
    select
      'memo' as kind,
      m.id as id,
      m.content as content,
      m.created_at as created_at,
      m.updated_at as updated_at,
      null as entry_date,
      null as goal_id,
      null as goal_title,
      null as goal_deleted_at
    from memos m
    where ${sql.join(memoConditions, sql` and `)}
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
      g.deleted_at as goal_deleted_at
    from daily_entries e
    join goals g on g.id = e.goal_id
    where ${sql.join(reflectionConditions, sql` and `)}
    order by created_at desc, id desc, kind desc
    limit ${options.limit + 1}
  `)

  const hasMore = rows.length > options.limit
  const pageRows = hasMore ? rows.slice(0, options.limit) : rows
  const memoRows = pageRows
    .filter(row => row.kind === 'memo')
    .map(row => ({
      id: row.id,
      content: row.content ?? '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: null,
    }))

  const memoContent = new Map(pageRows
    .filter(row => row.kind === 'memo')
    .map(row => [row.id, row]))

  const {
    goalsByMemo,
    entriesByMemo,
    hiddenByMemo,
    outgoingByMemo,
    incomingByMemo,
  } = loadMemoRelations(
    db,
    memoRows.map(row => row.id),
  )

  const repliesByEntry = loadEntryReplies(
    db,
    pageRows.filter(row => row.kind === 'daily_reflection').map(row => row.id),
  )

  const items = pageRows.map<FeedItem>((row) => {
    if (row.kind === 'memo') {
      const memoRow = memoContent.get(row.id)!
      return {
        kind: 'memo',
        id: row.id,
        content: memoRow.content ?? '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        goals: goalsByMemo.get(row.id) ?? [],
        entries: entriesByMemo.get(row.id) ?? [],
        hiddenEntryIds: hiddenByMemo.get(row.id) ?? [],
        outgoingMemos: outgoingByMemo.get(row.id) ?? [],
        incomingMemos: incomingByMemo.get(row.id) ?? [],
      }
    }

    return {
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
    }
  })

  const last = pageRows[pageRows.length - 1]

  return {
    items,
    nextCursor: hasMore && last
      ? encodeCursor({ createdAt: last.created_at, id: last.id, kind: last.kind })
      : null,
  }
}

export function getMemo(db: Database, id: string): Memo | null {
  const [row] = db
    .select()
    .from(memos)
    .where(and(eq(memos.id, id), isNull(memos.deletedAt)))
    .limit(1)
    .all()

  if (!row) return null
  return buildMemos(db, [row])[0] ?? null
}

function requireActiveGoalIds(db: Database, goalIds: string[]): void {
  if (goalIds.length === 0) return

  const rows = db
    .select({ id: goals.id, deletedAt: goals.deletedAt })
    .from(goals)
    .where(inArray(goals.id, goalIds))
    .all()

  if (rows.length !== goalIds.length) {
    throw apiError(400, 'INVALID_MEMO_LINK', '关联的习惯不存在')
  }
  if (rows.some(row => row.deletedAt !== null)) {
    throw apiError(400, 'INVALID_MEMO_LINK', '不能关联已删除的习惯')
  }
}

interface EntryLinkRow {
  id: string
  goalId: string
  entryDeletedAt: number | null
  goalDeletedAt: number | null
}

function readEntryLinks(db: Database, entryIds: string[]): EntryLinkRow[] {
  if (entryIds.length === 0) return []

  return db
    .select({
      id: dailyEntries.id,
      goalId: dailyEntries.goalId,
      entryDeletedAt: dailyEntries.deletedAt,
      goalDeletedAt: goals.deletedAt,
    })
    .from(dailyEntries)
    .innerJoin(goals, eq(goals.id, dailyEntries.goalId))
    .where(inArray(dailyEntries.id, entryIds))
    .all()
}

function requireActiveEntryIds(db: Database, entryIds: string[]): void {
  if (entryIds.length === 0) return

  const rows = readEntryLinks(db, entryIds)
  if (rows.length !== entryIds.length) {
    throw apiError(400, 'INVALID_MEMO_LINK', '关联的打卡记录不存在')
  }
  if (rows.some(row => row.entryDeletedAt !== null)) {
    throw apiError(400, 'INVALID_MEMO_LINK', '不能关联已删除的打卡记录')
  }
  if (rows.some(row => row.goalDeletedAt !== null)) {
    throw apiError(400, 'INVALID_MEMO_LINK', '不能关联已删除习惯的打卡记录')
  }
}

function insertLinks(
  db: Database,
  memoId: string,
  goalIds: string[],
  entryIds: string[],
  now: number,
): void {
  if (goalIds.length > 0) {
    db.insert(memoGoalLinks)
      .values(goalIds.map(goalId => ({ memoId, goalId, createdAt: now })))
      .run()
  }

  if (entryIds.length > 0) {
    db.insert(memoEntryLinks)
      .values(entryIds.map(entryId => ({ memoId, entryId, createdAt: now })))
      .run()
  }
}

export function createMemo(db: Database, input: MemoWriteInput): Memo {
  const goalIds = input.goalIds ?? []
  const entryIdSet = new Set(input.entryIds ?? [])
  if (input.replyTo?.type === 'entry') entryIdSet.add(input.replyTo.id)
  const entryIds = [...entryIdSet]
  const now = Math.floor(Date.now() / 1000)

  const memo = db.transaction((tx) => {
    const database = tx as unknown as Database

    requireActiveGoalIds(database, goalIds)
    requireActiveEntryIds(
      database,
      entryIds.filter(id => !(input.replyTo?.type === 'entry' && id === input.replyTo.id)),
    )
    if (input.replyTo) requireReviewSource(database, input.replyTo)

    const [row] = tx
      .insert(memos)
      .values({
        id: randomUUID(),
        content: input.content,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
      .returning()
      .all()

    if (!row) {
      throw apiError(500, 'MEMO_SAVE_FAILED', '笔记没有保存成功')
    }

    insertLinks(database, row.id, goalIds, entryIds, now)

    if (input.replyTo?.type === 'memo') {
      tx.insert(memoRelations)
        .values({
          sourceMemoId: row.id,
          targetMemoId: input.replyTo.id,
          createdAt: now,
        })
        .run()
    }

    if (input.replyTo) {
      markReviewRead(database, input.replyTo, now)
    }

    return row
  })

  return buildMemos(db, [memo])[0]!
}

export function requireActiveMemo(db: Database, id: string | undefined): MemoRow {
  if (!id) {
    throw apiError(404, 'MEMO_NOT_FOUND', '笔记不存在或已被删除')
  }

  const [row] = db
    .select()
    .from(memos)
    .where(and(eq(memos.id, id), isNull(memos.deletedAt)))
    .limit(1)
    .all()

  if (!row) {
    throw apiError(404, 'MEMO_NOT_FOUND', '笔记不存在或已被删除')
  }

  return row
}

export function updateMemo(db: Database, id: string, input: MemoWriteInput): Memo {
  const now = Math.floor(Date.now() / 1000)

  db.transaction((tx) => {
    const database = tx as unknown as Database
    requireActiveMemo(database, id)

    const existingGoalIds = new Set(
      tx
        .select({ goalId: memoGoalLinks.goalId })
        .from(memoGoalLinks)
        .where(eq(memoGoalLinks.memoId, id))
        .all()
        .map(row => row.goalId),
    )
    const existingEntryIds = new Set(
      tx
        .select({ entryId: memoEntryLinks.entryId })
        .from(memoEntryLinks)
        .where(eq(memoEntryLinks.memoId, id))
        .all()
        .map(row => row.entryId),
    )

    if (input.goalIds !== undefined) {
      const submitted = input.goalIds
      const newIds = submitted.filter(goalId => !existingGoalIds.has(goalId))
      requireActiveGoalIds(database, newIds)
    }

    if (input.entryIds !== undefined) {
      const submitted = input.entryIds
      const newIds = submitted.filter(entryId => !existingEntryIds.has(entryId))
      requireActiveEntryIds(database, newIds)
    }

    tx.update(memos)
      .set({ content: input.content, updatedAt: now })
      .where(eq(memos.id, id))
      .run()

    if (input.goalIds !== undefined) {
      const submitted = new Set(input.goalIds)
      const deletedGoalIds = existingGoalIds.size === 0
        ? []
        : tx
            .select({ id: goals.id })
            .from(goals)
            .where(and(
              inArray(goals.id, [...existingGoalIds]),
              sql`${goals.deletedAt} is not null`,
            ))
            .all()
            .map(row => row.id)
      const keep = new Set([...submitted, ...deletedGoalIds])

      tx.delete(memoGoalLinks).where(eq(memoGoalLinks.memoId, id)).run()
      if (keep.size > 0) {
        tx.insert(memoGoalLinks)
          .values([...keep].map(goalId => ({ memoId: id, goalId, createdAt: now })))
          .run()
      }
    }

    if (input.entryIds !== undefined) {
      const submitted = new Set(input.entryIds)
      const existingRows = existingEntryIds.size > 0
        ? readEntryLinks(database, [...existingEntryIds])
        : []
      const hidden = new Set(
        existingRows
          .filter(row => row.entryDeletedAt !== null)
          .map(row => row.id),
      )
      const keep = new Set([...submitted, ...hidden])

      tx.delete(memoEntryLinks).where(eq(memoEntryLinks.memoId, id)).run()
      if (keep.size > 0) {
        tx.insert(memoEntryLinks)
          .values([...keep].map(entryId => ({ memoId: id, entryId, createdAt: now })))
          .run()
      }
    }
  })

  return getMemo(db, id)!
}

export function deleteMemo(db: Database, id: string): void {
  const now = Math.floor(Date.now() / 1000)
  requireActiveMemo(db, id)

  db.update(memos)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(memos.id, id))
    .run()
}

export function getGoalRelatedMemos(db: Database, goalId: string): GoalRelatedMemos {
  const directIds = db
    .select({ id: memoGoalLinks.memoId })
    .from(memoGoalLinks)
    .where(eq(memoGoalLinks.goalId, goalId))
    .all()
    .map(row => row.id)

  const viaEntryIds = db
    .select({ id: memoEntryLinks.memoId })
    .from(memoEntryLinks)
    .innerJoin(dailyEntries, eq(dailyEntries.id, memoEntryLinks.entryId))
    .where(and(
      eq(dailyEntries.goalId, goalId),
      isNull(dailyEntries.deletedAt),
    ))
    .all()
    .map(row => row.id)

  const memoIds = [...new Set([...directIds, ...viaEntryIds])]
  const memoRows = memoIds.length === 0
    ? []
    : db
        .select()
        .from(memos)
        .where(and(
          inArray(memos.id, memoIds),
          isNull(memos.deletedAt),
        ))
        .orderBy(desc(memos.createdAt), desc(memos.id))
        .all()

  const reflectionRows = db
    .select()
    .from(dailyEntries)
    .where(and(
      eq(dailyEntries.goalId, goalId),
      isNull(dailyEntries.deletedAt),
      sql`length(trim(${dailyEntries.reflection})) > 0`,
    ))
    .orderBy(desc(dailyEntries.entryDate), desc(dailyEntries.id))
    .all()

  return {
    memos: buildMemos(db, memoRows),
    reflections: attachLinkedEntryIds(db, reflectionRows) as DailyEntryWithLinks[],
  }
}
