import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type {
  DailyEntryWithLinks,
  FeedPage,
  Goal,
  GoalRelatedMemos,
  Memo,
  MemoPage,
} from '../../shared/types'
import { todayDateOnly } from '../../shared/utils/date'

const tempDir = await mkdtemp(join(tmpdir(), 'anti-habit-memos-'))
process.env.DATABASE_URL = join(tempDir, 'test.db')
process.env.NITRO_NO_UNIX_SOCKET = '1'

await setup({ server: true })

const today = todayDateOnly()
let sequence = 0

function uniqueTitle(base: string): string {
  sequence += 1
  return `${base} ${Date.now()}-${sequence}`
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

async function listFeed(query = ''): Promise<FeedPage> {
  const { response, body } = await request(`/api/feed${query}`)
  expect(response.status).toBe(200)
  return body as FeedPage
}

async function listMemos(query = ''): Promise<MemoPage> {
  const { response, body } = await request(`/api/memos${query}`)
  expect(response.status).toBe(200)
  return body as MemoPage
}

async function getGoalMemos(goalId: string): Promise<GoalRelatedMemos> {
  const { response, body } = await request(`/api/goals/${goalId}/memos`)
  expect(response.status).toBe(200)
  return body as GoalRelatedMemos
}

describe('memos API', () => {
  it('creates a note without any goal and keeps it in the timeline', async () => {
    const content = uniqueTitle('今天想到：没有目标也能写')
    const memo = await createMemo({ content: `  ${content}  ` })

    expect(memo.content).toBe(content)
    expect(memo.goals).toEqual([])
    expect(memo.entries).toEqual([])
    expect(memo.hiddenEntryIds).toEqual([])

    const feed = await listFeed()
    const item = feed.items.find(entry => entry.kind === 'memo' && entry.id === memo.id)
    expect(item).toMatchObject({
      kind: 'memo',
      id: memo.id,
      content,
    })

    const fetched = await getMemo(memo.id)
    expect(fetched.content).toBe(content)
  })

  it('rejects empty notes and unknown links without creating partial rows', async () => {
    const empty = await request('/api/memos', {
      method: 'POST',
      body: JSON.stringify({ content: '   ' }),
    })
    expect(empty.response.status).toBe(400)
    expect(empty.body.data.code).toBe('INVALID_INPUT')
    expect(empty.body.data.message).toBe('笔记正文不能为空')

    const before = await listMemos('?limit=50')
    const invalid = await request('/api/memos', {
      method: 'POST',
      body: JSON.stringify({
        content: uniqueTitle('不该保存的笔记'),
        goalIds: ['missing-goal'],
      }),
    })
    expect(invalid.response.status).toBe(400)
    expect(invalid.body.data.code).toBe('INVALID_MEMO_LINK')

    const after = await listMemos('?limit=50')
    expect(after.memos.length).toBe(before.memos.length)
  })

  it('links a note to a habit and a specific check-in without changing the entry', async () => {
    const goal = await createGoal(uniqueTitle('戒色'))
    const entry = await putEntry(goal.id, today, {
      status: 'completed',
      reflection: '今天写下的一小段反思。',
    })

    const memo = await createMemo({
      content: uniqueTitle('由这次打卡想到'),
      goalIds: [goal.id],
      entryIds: [entry.id],
    })

    expect(memo.goals).toEqual([{ id: goal.id, title: goal.title, deletedAt: null }])
    expect(memo.entries).toEqual([{
      id: entry.id,
      entryDate: today,
      goalId: goal.id,
      goalTitle: goal.title,
      goalDeletedAt: null,
    }])

    const unchanged = await request(`/api/goals/${goal.id}/entries?from=${today}&to=${today}`)
    expect(unchanged.response.status).toBe(200)
    expect(unchanged.body.entries[0].status).toBe('completed')
    expect(unchanged.body.entries[0].reflection).toBe('今天写下的一小段反思。')

    const related = await getGoalMemos(goal.id)
    expect(related.memos.map(item => item.id)).toContain(memo.id)
    expect(related.reflections.map(item => item.id)).toContain(entry.id)

    const byGoal = await listFeed(`?goalId=${goal.id}`)
    expect(byGoal.items.some(item => item.kind === 'memo' && item.id === memo.id)).toBe(true)
    const reflection = byGoal.items.find(item => item.kind === 'daily_reflection')
    expect(reflection).toMatchObject({
      kind: 'daily_reflection',
      id: entry.id,
      entryDate: today,
      goalId: goal.id,
      content: '今天写下的一小段反思。',
    })
  })

  it('hides links to soft-deleted entries but restores them and keeps them on update', async () => {
    const goal = await createGoal(uniqueTitle('跑步'))
    const entry = await putEntry(goal.id, today, {
      status: 'missed',
      reflection: '没有跑，但记下了原因。',
    })
    const memo = await createMemo({
      content: uniqueTitle('关于没跑的那天'),
      goalIds: [goal.id],
      entryIds: [entry.id],
    })

    const removed = await request(`/api/goals/${goal.id}/entries/${today}`, { method: 'DELETE' })
    expect(removed.response.status).toBe(200)

    const hidden = await getMemo(memo.id)
    expect(hidden.entries).toEqual([])
    expect(hidden.hiddenEntryIds).toEqual([entry.id])

    const updated = await request(`/api/memos/${memo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        content: uniqueTitle('改写后的正文'),
        goalIds: [goal.id],
        entryIds: [],
      }),
    })
    expect(updated.response.status).toBe(200)
    expect(updated.body.memo.hiddenEntryIds).toEqual([entry.id])

    await putEntry(goal.id, today, {
      status: 'missed',
      reflection: '没有跑，但记下了原因。',
    })

    const restored = await getMemo(memo.id)
    expect(restored.entries.map(item => item.id)).toEqual([entry.id])
    expect(restored.hiddenEntryIds).toEqual([])
  })

  it('rolls back the whole update when a new link id is invalid', async () => {
    const goal = await createGoal(uniqueTitle('冥想'))
    const original = uniqueTitle('原来的正文')
    const memo = await createMemo({ content: original, goalIds: [goal.id] })

    const failed = await request(`/api/memos/${memo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        content: uniqueTitle('不应写进去的正文'),
        goalIds: [goal.id, 'missing-goal'],
      }),
    })
    expect(failed.response.status).toBe(400)
    expect(failed.body.data.code).toBe('INVALID_MEMO_LINK')

    const after = await getMemo(memo.id)
    expect(after.content).toBe(original)
    expect(after.goals.map(item => item.id)).toEqual([goal.id])
  })

  it('soft-deletes notes without touching entries, and keeps notes after a goal is deleted', async () => {
    const goal = await createGoal(uniqueTitle('早睡'))
    const entry = await putEntry(goal.id, today, {
      status: 'completed',
      reflection: '十一点前躺下了。',
    })
    const memo = await createMemo({
      content: uniqueTitle('删除目标后仍要保留'),
      goalIds: [goal.id],
      entryIds: [entry.id],
    })

    const deleted = await request(`/api/memos/${memo.id}`, { method: 'DELETE' })
    expect(deleted.response.status).toBe(200)
    expect((await request(`/api/memos/${memo.id}`)).response.status).toBe(404)
    expect((await listMemos('?limit=50')).memos.some(item => item.id === memo.id)).toBe(false)

    const entries = await request(`/api/goals/${goal.id}/entries?from=${today}&to=${today}`)
    expect(entries.body.entries.map((item: DailyEntryWithLinks) => item.id)).toContain(entry.id)

    const second = await createMemo({
      content: uniqueTitle('目标删除后仍可阅读'),
      goalIds: [goal.id],
      entryIds: [entry.id],
    })
    await request(`/api/goals/${goal.id}`, { method: 'DELETE' })

    const after = await getMemo(second.id)
    expect(after.goals[0]?.deletedAt).not.toBeNull()

    const feed = await listFeed(`?goalId=${goal.id}`)
    const reflection = feed.items.find(item => item.kind === 'daily_reflection' && item.id === entry.id)
    expect(reflection).toMatchObject({
      kind: 'daily_reflection',
      goalId: goal.id,
    })
    expect(reflection && reflection.kind === 'daily_reflection' ? reflection.goalDeletedAt : null)
      .not.toBeNull()
  })

  it('paginates the merged timeline and filters by keyword and link state', async () => {
    const goal = await createGoal(uniqueTitle('写作'))
    await putEntry(goal.id, today, {
      status: 'completed',
      reflection: '分页测试用的打卡反思。',
    })

    const marker = uniqueTitle('分页标记')
    const created = [
      await createMemo({ content: `${marker} 一`, goalIds: [goal.id] }),
      await createMemo({ content: `${marker} 二` }),
      await createMemo({ content: `${marker} 三` }),
      await createMemo({ content: `${marker} 四`, goalIds: [goal.id] }),
    ]

    const seen: string[] = []
    let cursor: string | null = null
    do {
      const page = await listFeed(`?q=${encodeURIComponent(marker)}&limit=3${cursor ? `&cursor=${cursor}` : ''}`)
      seen.push(...page.items.map(item => `${item.kind}:${item.id}`))
      cursor = page.nextCursor
    } while (cursor)

    expect(seen).toHaveLength(created.length)
    expect(new Set(seen).size).toBe(created.length)
    for (const memo of created) {
      expect(seen).toContain(`memo:${memo.id}`)
    }

    const linked = await listFeed(`?q=${encodeURIComponent(marker)}&linked=linked`)
    expect(linked.items.every(item => item.kind === 'memo' ? item.goals.length > 0 : true)).toBe(true)
    expect(linked.items).toHaveLength(2)

    const unlinked = await listFeed(`?q=${encodeURIComponent(marker)}&linked=unlinked`)
    expect(unlinked.items).toHaveLength(2)
    expect(unlinked.items.every(item => item.kind === 'memo')).toBe(true)

    const rejected = await request('/api/feed?cursor=not-a-cursor')
    expect(rejected.response.status).toBe(400)
    expect(rejected.body.data.code).toBe('INVALID_CURSOR')
  })
})
