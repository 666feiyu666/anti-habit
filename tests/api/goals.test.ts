import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { addDays } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type {
  DailyEntryWithLinks,
  EssayEntry,
  Goal,
  GoalMaterial,
  GoalMaterialSummary,
  GoalSummary,
} from '../../shared/types'
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

async function createGoal(title: string, essayTitle?: string | null): Promise<Goal> {
  const { response, body } = await request('/api/goals', {
    method: 'POST',
    body: JSON.stringify({
      title,
      ...(essayTitle !== undefined ? { essayTitle } : {}),
    }),
  })
  expect(response.status).toBe(201)
  return body.goal as Goal
}

async function putEntry(
  goalId: string,
  date: string,
  payload: {
    status: 'completed' | 'missed'
    reflection?: string | null
    linkedEntryIds?: string[]
  },
): Promise<DailyEntryWithLinks> {
  const { response, body } = await request(`/api/goals/${goalId}/entries/${date}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  expect(response.status).toBe(200)
  return body.entry as DailyEntryWithLinks
}

async function getEntries(goalId: string, from: string, to: string): Promise<DailyEntryWithLinks[]> {
  const { response, body } = await request(`/api/goals/${goalId}/entries?from=${from}&to=${to}`)
  expect(response.status).toBe(200)
  return body.entries as DailyEntryWithLinks[]
}

async function getEssays(goalId: string): Promise<EssayEntry[]> {
  const { response, body } = await request(`/api/goals/${goalId}/essays`)
  expect(response.status).toBe(200)
  return body.entries as EssayEntry[]
}

async function createMaterial(
  goalId: string,
  payload: {
    title?: string
    content: string
    sourceName?: string
  },
): Promise<GoalMaterial> {
  const { response, body } = await request(`/api/goals/${goalId}/materials`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  expect(response.status).toBe(201)
  return body.material as GoalMaterial
}

async function listMaterials(goalId: string): Promise<GoalMaterialSummary[]> {
  const { response, body } = await request(`/api/goals/${goalId}/materials`)
  expect(response.status).toBe(200)
  return body.materials as GoalMaterialSummary[]
}

async function getMaterial(goalId: string, materialId: string): Promise<GoalMaterial> {
  const { response, body } = await request(`/api/goals/${goalId}/materials/${materialId}`)
  expect(response.status).toBe(200)
  return body.material as GoalMaterial
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

  it('creates and updates an optional essay title', async () => {
    const goal = await createGoal(uniqueTitle('Walk 20 Minutes'), '  论散步  ')
    expect(goal.essayTitle).toBe('论散步')

    const renamedTitle = uniqueTitle('Walk 20 Minutes')
    const renamed = await request(`/api/goals/${goal.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: renamedTitle }),
    })
    expect(renamed.response.status).toBe(200)
    expect(renamed.body.goal.essayTitle).toBe('论散步')

    const cleared = await request(`/api/goals/${goal.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: renamedTitle, essayTitle: '   ' }),
    })
    expect(cleared.response.status).toBe(200)
    expect(cleared.body.goal.essayTitle).toBeNull()

    const overlong = await request(`/api/goals/${goal.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: renamedTitle, essayTitle: '论'.repeat(121) }),
    })
    expect(overlong.response.status).toBe(400)
    expect(overlong.body.data.message).toContain('Essay 题目')
  })

  it('links a later entry to an earlier one and returns both directions', async () => {
    const goal = await createGoal(uniqueTitle('Read Before Bed'))
    const early = await putEntry(goal.id, '2026-07-14', {
      status: 'missed',
      reflection: '欲望经常从无聊开始。',
    })
    const late = await putEntry(goal.id, '2026-08-11', {
      status: 'completed',
      reflection: '我以前把问题理解成了意志力。',
      linkedEntryIds: [early.id],
    })
    expect(late.linkedEntryIds).toEqual([early.id])

    const deduped = await putEntry(goal.id, '2026-08-11', {
      status: 'completed',
      reflection: '我以前把问题理解成了意志力。',
      linkedEntryIds: [early.id, early.id],
    })
    expect(deduped.linkedEntryIds).toEqual([early.id])

    await putEntry(goal.id, '2026-08-12', {
      status: 'completed',
      reflection: null,
    })

    const essays = await getEssays(goal.id)
    expect(essays.map(item => item.entry.id)).toEqual([late.id, early.id])
    expect(essays[0]?.outgoing[0]).toMatchObject({
      entryId: early.id,
      entryDate: '2026-07-14',
    })
    expect(essays[1]?.incoming[0]).toMatchObject({
      entryId: late.id,
      entryDate: '2026-08-11',
    })

    await putEntry(goal.id, '2026-07-14', {
      status: 'missed',
      reflection: null,
    })
    const hidden = await getEssays(goal.id)
    expect(hidden.map(item => item.entry.id)).toEqual([late.id])
    expect(hidden[0]?.outgoing).toEqual([])

    await putEntry(goal.id, '2026-07-14', {
      status: 'missed',
      reflection: '欲望经常从无聊开始。',
    })
    const restored = await getEssays(goal.id)
    expect(restored[1]?.incoming[0]?.entryId).toBe(late.id)

    const cleared = await putEntry(goal.id, '2026-08-11', {
      status: 'completed',
      reflection: '我以前把问题理解成了意志力。',
      linkedEntryIds: [],
    })
    expect(cleared.linkedEntryIds).toEqual([])
    expect((await getEssays(goal.id))[0]?.outgoing).toEqual([])
  })

  it('rejects invalid links and leaves the entry unchanged', async () => {
    const goal = await createGoal(uniqueTitle('Walk 20 Minutes'))
    const otherGoal = await createGoal(uniqueTitle('No Phone After 11 PM'))

    const early = await putEntry(goal.id, '2026-07-14', {
      status: 'missed',
      reflection: '较早的一天。',
    })
    const otherEntry = await putEntry(otherGoal.id, '2026-07-14', {
      status: 'completed',
      reflection: '另一个目标的一天。',
    })
    const laterEntry = await putEntry(goal.id, '2026-08-20', {
      status: 'completed',
      reflection: '更晚的一天。',
    })
    const deletedTarget = await putEntry(goal.id, '2026-07-15', {
      status: 'completed',
      reflection: '马上会被删除的一天。',
    })

    const original = await putEntry(goal.id, '2026-08-11', {
      status: 'completed',
      reflection: '原稿。',
    })

    await request(`/api/goals/${goal.id}/entries/2026-07-15`, { method: 'DELETE' })

    const invalidCases = [
      { linkedEntryIds: [original.id], code: 'INVALID_LINK' },
      { linkedEntryIds: [otherEntry.id], code: 'INVALID_LINK' },
      { linkedEntryIds: [laterEntry.id], code: 'INVALID_LINK' },
      { linkedEntryIds: [deletedTarget.id], code: 'INVALID_LINK' },
      { linkedEntryIds: ['00000000-0000-4000-8000-000000000000'], code: 'INVALID_LINK' },
      { linkedEntryIds: [early.id], code: 'INVALID_LINK', date: '2026-07-14' },
    ]

    for (const invalid of invalidCases) {
      const { response, body } = await request(
        `/api/goals/${goal.id}/entries/${invalid.date ?? '2026-08-11'}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            status: 'missed',
            reflection: '不应该被保存。',
            linkedEntryIds: invalid.linkedEntryIds,
          }),
        },
      )
      expect(response.status).toBe(400)
      expect(body.data.code).toBe(invalid.code)
    }

    const unchanged = await getEntries(goal.id, '2026-08-11', '2026-08-11')
    expect(unchanged[0]).toMatchObject({
      status: 'completed',
      reflection: '原稿。',
      linkedEntryIds: [],
    })
    expect((await getEssays(goal.id)).find(item => item.entry.id === original.id)?.outgoing).toEqual([])
  })

  it('soft deletes an entry and restores its id and links on save', async () => {
    const goal = await createGoal(uniqueTitle('Read Before Bed'))
    const early = await putEntry(goal.id, '2026-07-14', {
      status: 'missed',
      reflection: '较早的一天。',
    })
    const late = await putEntry(goal.id, '2026-08-11', {
      status: 'completed',
      reflection: '较晚的一天。',
      linkedEntryIds: [early.id],
    })

    const deleted = await request(`/api/goals/${goal.id}/entries/2026-08-11`, {
      method: 'DELETE',
    })
    expect(deleted.response.status).toBe(200)
    expect(await getEntries(goal.id, '2026-08-11', '2026-08-11')).toHaveLength(0)

    const afterDelete = await getEssays(goal.id)
    expect(afterDelete).toHaveLength(1)
    expect(afterDelete[0]?.entry.id).toBe(early.id)
    expect(afterDelete[0]?.incoming).toEqual([])

    const restored = await putEntry(goal.id, '2026-08-11', {
      status: 'completed',
      reflection: '较晚的一天。',
    })
    expect(restored.id).toBe(late.id)
    expect(restored.linkedEntryIds).toEqual([early.id])

    const afterRestore = await getEssays(goal.id)
    expect(afterRestore[0]?.entry.id).toBe(late.id)
    expect(afterRestore[1]?.incoming[0]?.entryId).toBe(late.id)

    const cleared = await putEntry(goal.id, '2026-08-11', {
      status: 'completed',
      reflection: '较晚的一天。',
      linkedEntryIds: [],
    })
    expect(cleared.linkedEntryIds).toEqual([])
    expect(afterRestore[1]?.entry.id).toBe(early.id)
    expect((await getEssays(goal.id))[1]?.incoming).toEqual([])
  })

  it('keeps existing links when the referenced day is soft deleted', async () => {
    const goal = await createGoal(uniqueTitle('Read Before Bed'))
    const early = await putEntry(goal.id, '2026-07-14', {
      status: 'missed',
      reflection: '较早的一天。',
    })
    const late = await putEntry(goal.id, '2026-08-11', {
      status: 'completed',
      reflection: '较晚的一天。',
      linkedEntryIds: [early.id],
    })
    const extra = await putEntry(goal.id, '2026-07-15', {
      status: 'completed',
      reflection: '另一个较早的一天。',
    })

    await request(`/api/goals/${goal.id}/entries/2026-07-14`, { method: 'DELETE' })
    await request(`/api/goals/${goal.id}/entries/2026-07-15`, { method: 'DELETE' })

    const edited = await putEntry(goal.id, '2026-08-11', {
      status: 'missed',
      reflection: '较晚的一天，改过状态。',
      linkedEntryIds: [early.id],
    })
    expect(edited.linkedEntryIds).toEqual([early.id])

    const hidden = await getEssays(goal.id)
    expect(hidden.map(item => item.entry.id)).toEqual([late.id])
    expect(hidden[0]?.outgoing).toEqual([])

    const rejected = await request(`/api/goals/${goal.id}/entries/2026-08-11`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'missed',
        reflection: '较晚的一天，改过状态。',
        linkedEntryIds: [early.id, extra.id],
      }),
    })
    expect(rejected.response.status).toBe(400)
    expect(rejected.body.data.code).toBe('INVALID_LINK')

    const restored = await putEntry(goal.id, '2026-07-14', {
      status: 'missed',
      reflection: '较早的一天。',
    })
    expect(restored.id).toBe(early.id)

    const afterRestore = await getEssays(goal.id)
    expect(afterRestore.map(item => item.entry.id)).toEqual([late.id, early.id])
    expect(afterRestore[1]?.incoming[0]?.entryId).toBe(late.id)
  })

  it('imports markdown as goal materials without touching daily entries', async () => {
    const goal = await createGoal(uniqueTitle('Read Before Bed'))
    await putEntry(goal.id, today, {
      status: 'missed',
      reflection: '今天的日记。',
    })

    const content = '# 素材标题\n\n第一段。\n\n- 列表项\n'
    const material = await createMaterial(goal.id, {
      title: '写作材料',
      content,
      sourceName: 'material.md',
    })

    expect(material.goalId).toBe(goal.id)
    expect(material.title).toBe('写作材料')
    expect(material.sourceName).toBe('material.md')
    expect(material.content).toBe(content)
    expect(material.createdAt).toBeTypeOf('number')
    expect(material.updatedAt).toBe(material.createdAt)

    const summaries = await listMaterials(goal.id)
    expect(summaries).toEqual([{
      id: material.id,
      goalId: goal.id,
      title: '写作材料',
      sourceName: 'material.md',
      characterCount: content.length,
      createdAt: material.createdAt,
      updatedAt: material.updatedAt,
    }])
    expect(summaries[0]).not.toHaveProperty('content')

    expect(await getMaterial(goal.id, material.id)).toEqual(material)

    const entries = await getEntries(goal.id, today, today)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.reflection).toBe('今天的日记。')
    expect(await getEssays(goal.id)).toHaveLength(1)
  })

  it('derives a title from the source name and normalizes line endings', async () => {
    const goal = await createGoal(uniqueTitle('Walk 20 Minutes'))
    const material = await createMaterial(goal.id, {
      content: '\uFEFF# 标题\r\n\r\n第一行。\r\n第二行。',
      sourceName: 'notes/我的材料.md',
    })

    expect(material.title).toBe('我的材料')
    expect(material.sourceName).toBe('notes/我的材料.md')
    expect(material.content).toBe('# 标题\n\n第一行。\n第二行。')
  })

  it('updates and deletes a material', async () => {
    const goal = await createGoal(uniqueTitle('Walk 20 Minutes'))
    const material = await createMaterial(goal.id, {
      title: '初稿',
      content: '第一版。',
      sourceName: 'draft.md',
    })

    const updated = await request(`/api/goals/${goal.id}/materials/${material.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: '  定稿  ', content: '第二版。\n' }),
    })
    expect(updated.response.status).toBe(200)
    expect(updated.body.material).toMatchObject({
      id: material.id,
      goalId: goal.id,
      title: '定稿',
      content: '第二版。\n',
      sourceName: 'draft.md',
    })
    expect(updated.body.material.createdAt).toBe(material.createdAt)

    const deleted = await request(`/api/goals/${goal.id}/materials/${material.id}`, {
      method: 'DELETE',
    })
    expect(deleted.response.status).toBe(200)
    expect(deleted.body.deleted).toBe(true)
    expect(await listMaterials(goal.id)).toEqual([])

    const missing = await request(`/api/goals/${goal.id}/materials/${material.id}`)
    expect(missing.response.status).toBe(404)
    expect(missing.body.data.code).toBe('MATERIAL_NOT_FOUND')
  })

  it('rejects empty materials, invalid updates, and cross-goal access', async () => {
    const goal = await createGoal(uniqueTitle('Read Before Bed'))
    const other = await createGoal(uniqueTitle('Walk 20 Minutes'))

    const empty = await request(`/api/goals/${goal.id}/materials`, {
      method: 'POST',
      body: JSON.stringify({ content: '   ' }),
    })
    expect(empty.response.status).toBe(400)
    expect(empty.body.data.code).toBe('INVALID_INPUT')
    expect(empty.body.data.message).toBe('材料正文不能为空')

    const material = await createMaterial(goal.id, {
      title: '材料',
      content: '正文。',
    })

    const crossGoal = await request(`/api/goals/${other.id}/materials/${material.id}`)
    expect(crossGoal.response.status).toBe(404)
    expect(crossGoal.body.data.code).toBe('MATERIAL_NOT_FOUND')

    const emptyTitle = await request(`/api/goals/${goal.id}/materials/${material.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: '   ', content: '正文。' }),
    })
    expect(emptyTitle.response.status).toBe(400)
    expect(emptyTitle.body.data.message).toBe('材料标题不能为空')

    const unknownGoal = await request('/api/goals/00000000-0000-4000-8000-000000000000/materials')
    expect(unknownGoal.response.status).toBe(404)
    expect(unknownGoal.body.data.code).toBe('GOAL_NOT_FOUND')
  })
})
