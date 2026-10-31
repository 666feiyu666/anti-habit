import { describe, expect, it } from 'vitest'
import type { EssayEntry } from '../../shared/types'
import { serializeEssayMarkdown } from '../../shared/utils/markdown-essay'

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

describe('markdown essay export', () => {
  it('serializes entries by date with status and links', () => {
    const entries = [
      essayEntry('entry-2', '2026-08-11', 'completed', '后来的一天。', [
        { entryId: 'entry-1', entryDate: '2026-07-14' },
        { entryId: 'entry-3', entryDate: '2026-07-01' },
        { entryId: 'entry-1-again', entryDate: '2026-07-14' },
      ]),
      essayEntry('entry-1', '2026-07-14', 'missed', '较早的一天。'),
    ]

    const markdown = serializeEssayMarkdown({
      essayTitle: '论散步',
      goalTitle: '每天散步二十分钟',
      entries,
    })

    expect(markdown).toBe(`# 论散步

> 每天散步二十分钟

## 2026-07-14

<!-- anti-habit status: missed -->

较早的一天。

## 2026-08-11

<!-- anti-habit status: completed; links: 2026-07-01, 2026-07-14 -->

后来的一天。
`)
  })

  it('falls back to 随笔 and skips entries without a body', () => {
    const markdown = serializeEssayMarkdown({
      essayTitle: '   ',
      goalTitle: '不看色情内容',
      entries: [
        essayEntry('entry-1', '2026-07-14', 'completed', '   '),
        essayEntry('entry-2', '2026-07-15', 'completed', '只有一天有正文。'),
      ],
    })

    expect(markdown).toContain('# 随笔')
    expect(markdown).toContain('## 2026-07-15')
    expect(markdown).not.toContain('## 2026-07-14')
  })
})
