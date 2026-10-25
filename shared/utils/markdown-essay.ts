import type { EssayEntry, ImportedEssayEntry } from '../types'
import { isValidDateOnly } from './date'

export interface ParsedEssayMarkdown {
  entries: ImportedEssayEntry[]
  mode: 'dated' | 'single'
}

interface DateHeading {
  index: number
  end: number
  date: string
}

const HEADING_PATTERN = /^#{2,4}[ \t]+(.+)$/gm
const META_PATTERN = /<!--\s*anti-habit\s+status:\s*(completed|missed)(?:\s*;\s*links:\s*([^>]*))?\s*-->/i

function dateFromHeading(title: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ \t]|$)/.exec(title)
  if (iso) {
    const date = `${iso[1]}-${iso[2]}-${iso[3]}`
    return isValidDateOnly(date) ? date : null
  }

  const chinese = /^(\d{4})年(\d{1,2})月(\d{1,2})日(?:[ \t]|$)/.exec(title)
  if (chinese) {
    const date = `${chinese[1]}-${String(Number(chinese[2])).padStart(2, '0')}-${String(Number(chinese[3])).padStart(2, '0')}`
    return isValidDateOnly(date) ? date : null
  }

  return null
}

function readMeta(section: string): {
  status: 'completed' | 'missed'
  linkedEntryDates: string[]
  body: string
} {
  const meta = META_PATTERN.exec(section)
  if (!meta) {
    return {
      status: 'completed',
      linkedEntryDates: [],
      body: section.trim(),
    }
  }

  const linkedEntryDates = (meta[2] ?? '')
    .split(/[,，、\s]+/)
    .map(value => value.trim())
    .filter(Boolean)

  for (const date of linkedEntryDates) {
    if (!isValidDateOnly(date)) {
      throw new Error(`关联日期“${date}”格式无效。`)
    }
  }

  return {
    status: meta[1] === 'missed' ? 'missed' : 'completed',
    linkedEntryDates: [...new Set(linkedEntryDates)],
    body: section.replace(meta[0], '').trim(),
  }
}

export function parseEssayMarkdown(
  input: string,
  fallbackDate: string,
): ParsedEssayMarkdown {
  const text = input.replace(/\r\n?/g, '\n')
  const headings: DateHeading[] = []

  for (const match of text.matchAll(HEADING_PATTERN)) {
    const date = dateFromHeading(match[1]?.trim() ?? '')
    if (!date || match.index === undefined) continue
    headings.push({
      index: match.index,
      end: match.index + match[0].length,
      date,
    })
  }

  if (headings.length === 0) {
    const meta = readMeta(text)
    if (!meta.body) throw new Error('文件里没有正文。')
    if (!isValidDateOnly(fallbackDate)) throw new Error('导入日期无效。')

    return {
      mode: 'single',
      entries: [{
        entryDate: fallbackDate,
        status: meta.status,
        reflection: meta.body,
        linkedEntryDates: meta.linkedEntryDates,
      }],
    }
  }

  const entries: ImportedEssayEntry[] = []
  const seen = new Set<string>()

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]!
    const next = headings[index + 1]
    const section = text.slice(heading.end, next?.index ?? text.length)
    const meta = readMeta(section)

    if (!meta.body) continue
    if (seen.has(heading.date)) {
      throw new Error(`日期 ${heading.date} 在文件里出现了两次。`)
    }
    seen.add(heading.date)

    entries.push({
      entryDate: heading.date,
      status: meta.status,
      reflection: meta.body,
      linkedEntryDates: meta.linkedEntryDates,
    })
  }

  if (!entries.length) throw new Error('没有找到正文。')

  return { mode: 'dated', entries }
}

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
