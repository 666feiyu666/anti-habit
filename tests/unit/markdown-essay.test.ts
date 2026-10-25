import { describe, expect, it } from 'vitest'
import type { EssayEntry } from '../../shared/types'
import { parseEssayMarkdown, serializeEssayMarkdown } from '../../shared/utils/markdown-essay'

function essayEntry(
  id: string,
  entryDate: string,
  status: 'completed' | 'missed',
  reflection: string,
  outgoing: Array<{ entryId: string, entryDate: string }> = [],
): EssayEntry {
  return {
    entry: {
      id,
      goalId: 'goal-1',
      entryDate,
      status,
      reflection,
      createdAt: 1,
      updatedAt: 1,
    },
    outgoing: outgoing.map(reference => ({
      ...reference,
      status,
      excerpt: '',
    })),
    incoming: [],
  }
}

describe('markdown essay format', () => {
  it('reads dated sections and metadata', () => {
    const parsed = parseEssayMarkdown(`# 论散步

> 每天散步二十分钟

## 2026-07-14 星期二
<!-- anti-habit status: missed; links: 2026-07-01 -->

第一篇。

## 2026年8月11日
<!-- anti-habit status: completed -->

第二篇。
`, '2026-10-25')

    expect(parsed.mode).toBe('dated')
    expect(parsed.entries).toEqual([
      {
        entryDate: '2026-07-14',
        status: 'missed',
        reflection: '第一篇。',
        linkedEntryDates: ['2026-07-01'],
      },
      {
        entryDate: '2026-08-11',
        status: 'completed',
        reflection: '第二篇。',
        linkedEntryDates: [],
      },
    ])
  })

  it('imports a file without dates as one entry on the fallback date', () => {
    const parsed = parseEssayMarkdown('一段没有日期的正文。', '2026-10-25')

    expect(parsed.mode).toBe('single')
    expect(parsed.entries).toEqual([{
      entryDate: '2026-10-25',
      status: 'completed',
      reflection: '一段没有日期的正文。',
      linkedEntryDates: [],
    }])
  })

  it('rejects duplicate dates and empty files', () => {
    expect(() => parseEssayMarkdown(`## 2026-07-14\n\n一天。\n\n## 2026-07-14\n\n又一天。`, '2026-10-25'))
      .toThrow('出现了两次')
    expect(() => parseEssayMarkdown('   ', '2026-10-25')).toThrow('没有正文')
  })

  it('round-trips dates, status, body, and links', () => {
    const entries = [
      essayEntry('entry-2', '2026-08-11', 'completed', '后来的一天。', [
        { entryId: 'entry-1', entryDate: '2026-07-14' },
      ]),
      essayEntry('entry-1', '2026-07-14', 'missed', '较早的一天。'),
    ]

    const markdown = serializeEssayMarkdown({
      essayTitle: '论散步',
      goalTitle: '每天散步二十分钟',
      entries,
    })
    const parsed = parseEssayMarkdown(markdown, '2026-10-25')

    expect(parsed.mode).toBe('dated')
    expect(parsed.entries).toEqual([
      {
        entryDate: '2026-07-14',
        status: 'missed',
        reflection: '较早的一天。',
        linkedEntryDates: [],
      },
      {
        entryDate: '2026-08-11',
        status: 'completed',
        reflection: '后来的一天。',
        linkedEntryDates: ['2026-07-14'],
      },
    ])
  })
})
