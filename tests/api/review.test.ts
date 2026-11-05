import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type {
  DailyEntryWithLinks,
  FeedPage,
  Goal,
  Memo,
  MemoPage,
  ReviewPage,
} from '../../shared/types'
import { todayDateOnly } from '../../shared/utils/date'

const tempDir = await mkdtemp(join(tmpdir(), 'anti-habit-review-'))
const databasePath = join(tempDir, 'test.db')
process.env.DATABASE_URL = databasePath
process.env.NITRO_NO_UNIX_SOCKET = '1'

await setup({ server: true })

let sqlite: Database.Database
let sequence = 0
const DAY = 86_400

beforeAll(() => {
  sqlite = new Database(databasePath)
  sqlite.pragma('busy_timeout = 5000')
})

afterAll(() => {
  sqlite.close()
})

function now(): number {
  return Math.floor(Date.now() / 1000)
}

function unique(prefix: string): string {
  sequence += 1
  return `${prefix} ${Date.now()}-${sequence}`
}

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  if (options.body !== undefined) headers.set('content-type', 'application/json')

  const response = await fetch(path, { ...options, headers })
  const text = await response.text()
  return {
    response,
    body: text ? JSON.parse(text) : null,
  }
}

async function createGoal(title: string): Promise<Goal> {
  const { response, body } = await request('/api/goals', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
  expect(response.status).toBe(201)
  return body.goal as Goal
}

async function putEntry(
  goalId: string,
  date: string,
  payload: { status: 'completed' | 'missed', reflection?: string | null },
): Promise<DailyEntryWithLinks> {
  const { response, body } = await request(`/api/goals/${goalId}/entries/${date}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  expect(response.status).toBe(200)
  return body.entry as DailyEntryWithLinks
}

async function createMemo(payload: unknown): Promise<Memo> {
  const { response, body } = await request('/api/memos', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  expect(response.status).toBe(201)
  return body.memo as Memo
}

async function getMemo(id: string): Promise<Memo> {
  const { response, body } = await request(`/api/memos/${id}`)
  expect(response.status).toBe(200)
  return body.memo as Memo
}

async function listReview(query = ''): Promise<ReviewPage> {
  const { response, body } = await request(`/api/review${query}`)
  expect(response.status).toBe(200)
  return body as ReviewPage
}

async function act(
  type: 'memo' | 'entry',
  id: string,
  action: 'read' | 'later' | 'dismiss',
) {
  return await request(`/api/review/${type}/${id}`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  })
}

function backdateMemo(id: string, days: number): void {
  sqlite
    .prepare('update memos set created_at = ? where id = ?')
    .run(now() - days * DAY, id)
}

function backdateEntry(id: string, days: number): void {
  sqlite
    .prepare('update daily_entries set created_at = ? where id = ?')
    .run(now() - days * DAY, id)
}

function setNextReview(type: 'memo' | 'entry', id: string, next: number): void {
  const column = type === 'memo' ? 'memo_id' : 'entry_id'
  sqlite
    .prepare(`update review_states set next_review_at = ? where ${column} = ?`)
    .run(next, id)
}

function stateFor(type: 'memo' | 'entry', id: string) {
  const column = type === 'memo' ? 'memo_id' : 'entry_id'
  return sqlite
    .prepare(`
      select memo_id, entry_id, last_reviewed_at, next_review_at, dismissed_at
      from review_states
      where ${column} = ?
    `)
    .get(id) as {
      memo_id: string | null
      entry_id: string | null
      last_reviewed_at: number | null
      next_review_at: number | null
      dismissed_at: number | null
    } | undefined
}

async function dismissAllCandidates(): Promise<void> {
  let cursor: string | null = null

  do {
    const page = await listReview(`?limit=50${cursor ? `&cursor=${cursor}` : ''}`)
    for (const item of page.items) {
      await act(item.sourceType, item.id, 'dismiss')
    }
    cursor = page.nextCursor
  } while (cursor)
}

beforeEach(async () => {
  await dismissAllCandidates()
})

describe('memo relations', () => {
  it('records a reply in both directions and marks the source read', async () => {
    const source = await createMemo({ content: unique('旧笔记') })
    const reply = await createMemo({
      content: unique('回应旧笔记'),
      replyTo: { type: 'memo', id: source.id },
    })

    const sourceAfter = await getMemo(source.id)
    expect(sourceAfter.incomingMemos.map(item => item.id)).toContain(reply.id)

    const replyAfter = await getMemo(reply.id)
    expect(replyAfter.outgoingMemos.map(item => item.id)).toContain(source.id)

    const state = stateFor('memo', source.id)
    expect(state?.next_review_at).toBeGreaterThan(now() + 20 * DAY)

    const feed = await request('/api/feed?limit=50')
    const sourceItem = (feed.body as FeedPage).items.find(
      item => item.kind === 'memo' && item.id === source.id,
    )
    expect(sourceItem && sourceItem.kind === 'memo'
      ? sourceItem.incomingMemos.map(item => item.id)
      : []).toContain(reply.id)

    await request(`/api/memos/${reply.id}`, { method: 'DELETE' })

    const afterDelete = await getMemo(source.id)
    expect(afterDelete.incomingMemos.map(item => item.id)).not.toContain(reply.id)
  })

  it('links a reply to an entry and exposes it on the reflection', async () => {
    const goal = await createGoal(unique('戒色'))
    const entry = await putEntry(goal.id, todayDateOnly(), {
      status: 'completed',
      reflection: unique('当天反思'),
    })

    const reply = await createMemo({
      content: unique('由反思继续写'),
      replyTo: { type: 'entry', id: entry.id },
    })

    expect(reply.entries.map(item => item.id)).toContain(entry.id)
    expect(stateFor('entry', entry.id)?.next_review_at).toBeGreaterThan(now() + 20 * DAY)

    const feed = await request('/api/feed?limit=50')
    const reflection = (feed.body as FeedPage).items.find(
      item => item.kind === 'daily_reflection' && item.id === entry.id,
    )
    expect(reflection && reflection.kind === 'daily_reflection'
      ? reflection.replies.map(item => item.id)
      : []).toContain(reply.id)

    const related = await request(`/api/goals/${goal.id}/memos`)
    expect(related.body.memos.map((item: Memo) => item.id)).toContain(reply.id)
  })

  it('rejects an invalid reply source without creating a memo', async () => {
    const before = await request('/api/memos?limit=50')
    const failed = await request('/api/memos', {
      method: 'POST',
      body: JSON.stringify({
        content: unique('不应保存的回应'),
        replyTo: { type: 'memo', id: 'missing-memo' },
      }),
    })

    expect(failed.response.status).toBe(404)
    expect(failed.body.data.code).toBe('REVIEW_SOURCE_NOT_FOUND')

    const after = await request('/api/memos?limit=50')
    expect((after.body as MemoPage).memos.length)
      .toBe((before.body as MemoPage).memos.length)
  })
})

describe('review queue', () => {
  it('shows a record after seven days and applies read, later, and dismiss', async () => {
    const memo = await createMemo({ content: unique('第一次回看') })
    backdateMemo(memo.id, 8)

    const firstPage = await listReview('?limit=50')
    const first = firstPage.items.find(item => item.id === memo.id)
    expect(first).toMatchObject({
      sourceType: 'memo',
      reviewReason: 'first',
    })

    const direct = await request(`/api/review/memo/${memo.id}`)
    expect(direct.response.status).toBe(200)
    expect(direct.body.item.id).toBe(memo.id)

    const read = await act('memo', memo.id, 'read')
    expect(read.response.status).toBe(200)
    expect(stateFor('memo', memo.id)?.last_reviewed_at).toBeGreaterThan(now() - 5)
    expect((await listReview('?limit=50')).items.some(item => item.id === memo.id)).toBe(false)

    setNextReview('memo', memo.id, now() - 1)
    const dueAgain = await listReview('?limit=50')
    expect(dueAgain.items.find(item => item.id === memo.id)?.reviewReason).toBe('due')

    const later = await act('memo', memo.id, 'later')
    expect(later.response.status).toBe(200)
    expect(stateFor('memo', memo.id)?.next_review_at).toBeGreaterThan(now() + 6 * DAY)
    expect((await listReview('?limit=50')).items.some(item => item.id === memo.id)).toBe(false)

    setNextReview('memo', memo.id, now() - 1)
    expect((await listReview('?limit=50')).items.some(item => item.id === memo.id)).toBe(true)

    const dismissed = await act('memo', memo.id, 'dismiss')
    expect(dismissed.response.status).toBe(200)
    expect(stateFor('memo', memo.id)?.dismissed_at).not.toBeNull()

    setNextReview('memo', memo.id, now() - 1)
    expect((await listReview('?limit=50')).items.some(item => item.id === memo.id)).toBe(false)
  })

  it('keeps review state when the source is deleted and hides the candidate', async () => {
    const memo = await createMemo({ content: unique('将被删除的旧笔记') })
    backdateMemo(memo.id, 8)
    await act('memo', memo.id, 'later')
    setNextReview('memo', memo.id, now() - 1)

    expect((await listReview('?limit=50')).items.some(item => item.id === memo.id)).toBe(true)

    await request(`/api/memos/${memo.id}`, { method: 'DELETE' })

    expect((await listReview('?limit=50')).items.some(item => item.id === memo.id)).toBe(false)
    expect(stateFor('memo', memo.id)?.dismissed_at).toBeNull()
  })

  it('includes reflections and hides cleared entries', async () => {
    const goal = await createGoal(unique('散步'))
    const entry = await putEntry(goal.id, todayDateOnly(), {
      status: 'missed',
      reflection: unique('没有出门'),
    })
    backdateEntry(entry.id, 8)

    const page = await listReview('?limit=50')
    expect(page.items.find(item => item.id === entry.id)).toMatchObject({
      sourceType: 'entry',
      reviewReason: 'first',
    })

    await act('entry', entry.id, 'read')
    await request(`/api/goals/${goal.id}/entries/${todayDateOnly()}`, { method: 'DELETE' })

    expect((await listReview('?limit=50')).items.some(item => item.id === entry.id)).toBe(false)
    expect(stateFor('entry', entry.id)?.last_reviewed_at).not.toBeNull()
  })

  it('paginates stably and rejects an invalid cursor', async () => {
    const created = [
      await createMemo({ content: unique('分页回看一') }),
      await createMemo({ content: unique('分页回看二') }),
      await createMemo({ content: unique('分页回看三') }),
    ]
    backdateMemo(created[0]!.id, 10)
    backdateMemo(created[1]!.id, 9)
    backdateMemo(created[2]!.id, 8)

    const first = await listReview('?limit=2')
    expect(first.items).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()

    const second = await listReview(`?limit=2&cursor=${first.nextCursor}`)
    expect(second.items).toHaveLength(1)
    expect(second.nextCursor).toBeNull()

    const ids = [...first.items, ...second.items].map(item => item.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids).toEqual([
      created[0]!.id,
      created[1]!.id,
      created[2]!.id,
    ])

    const invalid = await request('/api/review?cursor=not-a-cursor')
    expect(invalid.response.status).toBe(400)
    expect(invalid.body.data.code).toBe('INVALID_CURSOR')

    const badAction = await request(`/api/review/memo/${created[0]!.id}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'archive' }),
    })
    expect(badAction.response.status).toBe(400)
    expect(badAction.body.data.code).toBe('INVALID_INPUT')
  })
})
