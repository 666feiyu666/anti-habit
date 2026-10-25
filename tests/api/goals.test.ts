import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { addDays } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type { DailyEntry, Goal, GoalSummary } from '../../shared/types'
import { todayDateOnly } from '../../shared/utils/date'

const tempDir = await mkdtemp(join(tmpdir(), 'anti-habit-api-'))
const databasePath = join(tempDir, 'test.db')

process.env.DATABASE_URL = databasePath
process.env.NITRO_NO_UNIX_SOCKET = '1'

await setup({ server: true })

const today = todayDateOnly()
const tomorrow = todayDateOnly(addDays(new Date(), 1))
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
  payload: { status: 'completed' | 'missed'; reflection?: string | null },
): Promise<DailyEntry> {
  const { response, body } = await request(`/api/goals/${goalId}/entries/${date}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  expect(response.status).toBe(200)
  return body.entry as DailyEntry
}

async function getEntries(goalId: string, from: string, to: string): Promise<DailyEntry[]> {
  const { response, body } = await request(`/api/goals/${goalId}/entries?from=${from}&to=${to}`)
  expect(response.status).toBe(200)
  return body.entries as DailyEntry[]
}

describe('goals API', () => {
  it('creates a goal, trims its title, and lists it with today status', async () => {
    const title = uniqueTitle('Walk 20 Minutes')
    const { response, body } = await request('/api/goals', {
      method: 'POST',
      body: JSON.stringify({ title: `   ${title}   ` }),
    })

    expect(response.status).toBe(201)
    expect(body.goal.title).toBe(title)
    expect(body.goal.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(body.goal.deletedAt).toBeNull()

    const listed = await request(`/api/goals?date=${today}`)
    expect(listed.response.status).toBe(200)
    const summary = (listed.body.goals as GoalSummary[]).find(goal => goal.id === body.goal.id)
    expect(summary).toBeTruthy()
    expect(summary?.todayEntry).toBeNull()
  })

  it('rejects empty, overlong, and duplicate titles', async () => {
    const empty = await request('/api/goals', {
      method: 'POST',
      body: JSON.stringify({ title: '   ' }),
    })
    expect(empty.response.status).toBe(400)
    expect(empty.body.data.code).toBe('INVALID_INPUT')
    expect(empty.body.data.message).toBe('目标名称不能为空')

    const overlong = await request('/api/goals', {
      method: 'POST',
      body: JSON.stringify({ title: 'a'.repeat(81) }),
    })
    expect(overlong.response.status).toBe(400)
    expect(overlong.body.data.code).toBe('INVALID_INPUT')

    const title = uniqueTitle('No Phone After 11 PM')
    await createGoal(title)

    const duplicate = await request('/api/goals', {
      method: 'POST',
      body: JSON.stringify({ title: title.toUpperCase() }),
    })
    expect(duplicate.response.status).toBe(409)
    expect(duplicate.body.data).toEqual({
      code: 'GOAL_TITLE_EXISTS',
      message: '已有同名目标，请换一个名称',
    })
  })

  it('gets, renames, and preserves entries for a goal', async () => {
    const goal = await createGoal(uniqueTitle('Read Before Bed'))
    await putEntry(goal.id, today, { status: 'completed', reflection: null })

    const detail = await request(`/api/goals/${goal.id}`)
    expect(detail.response.status).toBe(200)
    expect(detail.body.goal.title).toBe(goal.title)

    const renamedTitle = uniqueTitle('Read a Book Before Bed')
    const renamed = await request(`/api/goals/${goal.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: renamedTitle }),
    })
    expect(renamed.response.status).toBe(200)
    expect(renamed.body.goal.id).toBe(goal.id)
    expect(renamed.body.goal.title).toBe(renamedTitle)

    const entries = await getEntries(goal.id, today, today)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.status).toBe('completed')
  })

  it('rejects renaming a goal to another active goal name', async () => {
    const first = await createGoal(uniqueTitle('First Goal'))
    const second = await createGoal(uniqueTitle('Second Goal'))

    const conflict = await request(`/api/goals/${first.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: second.title.toLowerCase() }),
    })
    expect(conflict.response.status).toBe(409)
    expect(conflict.body.data.code).toBe('GOAL_TITLE_EXISTS')
  })

  it('upserts completed and missed entries and clears reflections', async () => {
    const goal = await createGoal(uniqueTitle('Walk 20 Minutes'))

    const completed = await putEntry(goal.id, today, { status: 'completed', reflection: null })
    expect(completed.status).toBe('completed')
    expect(completed.reflection).toBeNull()

    const missedWithoutReflection = await putEntry(goal.id, today, {
      status: 'missed',
      reflection: '   ',
    })
    expect(missedWithoutReflection.id).toBe(completed.id)
    expect(missedWithoutReflection.status).toBe('missed')
    expect(missedWithoutReflection.reflection).toBeNull()

    const missedWithReflection = await putEntry(goal.id, today, {
      status: 'missed',
      reflection: '  晚上有点累，刷手机的时间比预期长。  ',
    })
    expect(missedWithReflection.status).toBe('missed')
    expect(missedWithReflection.reflection).toBe('晚上有点累，刷手机的时间比预期长。')
    expect(missedWithReflection.createdAt).toBe(completed.createdAt)

    const entries = await getEntries(goal.id, today, today)
    expect(entries).toHaveLength(1)

    const cleared = await request(`/api/goals/${goal.id}/entries/${today}`, { method: 'DELETE' })
    expect(cleared.response.status).toBe(200)
    expect(cleared.body.deleted).toBe(true)
    expect(await getEntries(goal.id, today, today)).toHaveLength(0)

    const clearedAgain = await request(`/api/goals/${goal.id}/entries/${today}`, { method: 'DELETE' })
    expect(clearedAgain.response.status).toBe(200)
  })

  it('rejects future dates and invalid ranges', async () => {
    const goal = await createGoal(uniqueTitle('No Phone After 11 PM'))

    const future = await request(`/api/goals/${goal.id}/entries/${tomorrow}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'completed' }),
    })
    expect(future.response.status).toBe(400)
    expect(future.body.data).toEqual({
      code: 'FUTURE_DATE',
      message: '不能记录未来的日期',
    })

    const reversed = await request(`/api/goals/${goal.id}/entries?from=2026-10-31&to=2026-10-01`)
    expect(reversed.response.status).toBe(400)
    expect(reversed.body.data.code).toBe('INVALID_RANGE')

    const reversedSpan = await request(`/api/goals/${goal.id}/entries?from=2026-01-01&to=2027-06-01`)
    expect(reversedSpan.response.status).toBe(400)
    expect(reversedSpan.body.data.code).toBe('RANGE_TOO_LARGE')

    const missing = await request(`/api/goals/${goal.id}/entries?to=2026-10-01`)
    expect(missing.response.status).toBe(400)
    expect(missing.body.data.code).toBe('INVALID_DATE')

    const invalidDate = await request(`/api/goals/${goal.id}/entries?from=2026-02-30&to=2026-03-01`)
    expect(invalidDate.response.status).toBe(400)
    expect(invalidDate.body.data.code).toBe('INVALID_DATE')
  })

  it('soft deletes a goal while keeping its entries in SQLite', async () => {
    const goal = await createGoal(uniqueTitle('Walk 20 Minutes'))
    await putEntry(goal.id, today, {
      status: 'missed',
      reflection: '软删除后这条记录仍应保留。',
    })

    const deleted = await request(`/api/goals/${goal.id}`, { method: 'DELETE' })
    expect(deleted.response.status).toBe(200)
    expect(deleted.body.deleted).toBe(true)

    const detail = await request(`/api/goals/${goal.id}`)
    expect(detail.response.status).toBe(404)
    expect(detail.body.data.code).toBe('GOAL_NOT_FOUND')

    const entries = await request(`/api/goals/${goal.id}/entries?from=${today}&to=${today}`)
    expect(entries.response.status).toBe(404)

    const listed = await request('/api/goals')
    expect((listed.body.goals as GoalSummary[]).some(item => item.id === goal.id)).toBe(false)

    const sqlite = new Database(databasePath, { readonly: true })
    try {
      const goalRow = sqlite
        .prepare('select deleted_at from goals where id = ?')
        .get(goal.id) as { deleted_at: number | null } | undefined
      expect(goalRow?.deleted_at).not.toBeNull()

      const entryRow = sqlite
        .prepare('select status, reflection from daily_entries where goal_id = ? and entry_date = ?')
        .get(goal.id, today) as { status: string, reflection: string | null } | undefined
      expect(entryRow).toEqual({
        status: 'missed',
        reflection: '软删除后这条记录仍应保留。',
      })
    } finally {
      sqlite.close()
    }
  })

  it('returns 404 for unknown goals', async () => {
    const missing = await request('/api/goals/00000000-0000-4000-8000-000000000000')
    expect(missing.response.status).toBe(404)
    expect(missing.body.data.code).toBe('GOAL_NOT_FOUND')
  })
})
