import type { EssayEntry } from '../types'

export function serializeEssayMarkdown(options: {
  essayTitle: string | null
  goalTitle: string
  entries: EssayEntry[]
}): string {
  const title = options.essayTitle?.trim() || '随笔'
  const lines = [`# ${title}`, '', `> ${options.goalTitle}`, '']

  const entries = [...options.entries].sort(
    (left, right) => left.entry.entryDate.localeCompare(right.entry.entryDate),
  )

  for (const item of entries) {
    const body = item.entry.reflection?.trim()
    if (!body) continue

    const links = [...new Set(item.outgoing.map(reference => reference.entryDate))]
      .sort()
      .join(', ')
    const meta = `<!-- anti-habit status: ${item.entry.status}${links ? `; links: ${links}` : ''} -->`

    lines.push(`## ${item.entry.entryDate}`, '', meta, '', body, '')
  }

  return `${lines.join('\n').trim()}\n`
}
