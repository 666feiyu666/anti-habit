import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import type { DailyEntry, DailyEntryWithLinks, EssayEntry, EssayReference } from '~~/shared/types'
import { dailyEntries, entryLinks, type DailyEntryRow } from '../database/schema'
import type { AppDatabase } from './db'

const EXCERPT_MAX_LENGTH = 120

export function toDailyEntry(row: DailyEntryRow): DailyEntry {
  const { deletedAt: _deletedAt, ...entry } = row
  return entry
}

function toReference(row: DailyEntryRow): EssayReference {
  const reflection = row.reflection ?? ''
  return {
    entryId: row.id,
    entryDate: row.entryDate,
    status: row.status,
    excerpt: reflection.length > EXCERPT_MAX_LENGTH
      ? `${reflection.slice(0, EXCERPT_MAX_LENGTH)}…`
      : reflection,
  }
}

export function getOutgoingLinkMap(db: AppDatabase, sourceIds: string[]) {
  const map = new Map<string, string[]>()
  if (sourceIds.length === 0) return map

  const rows = db
    .select()
    .from(entryLinks)
    .where(inArray(entryLinks.sourceEntryId, sourceIds))
    .all()

  for (const row of rows) {
    const ids = map.get(row.sourceEntryId) ?? []
    ids.push(row.targetEntryId)
    map.set(row.sourceEntryId, ids)
  }

  return map
}

export function attachLinkedEntryIds(
  db: AppDatabase,
  entries: DailyEntryRow[],
): DailyEntryWithLinks[] {
  const linkedByEntry = getOutgoingLinkMap(db, entries.map(entry => entry.id))

  return entries.map(entry => ({
    ...toDailyEntry(entry),
    linkedEntryIds: linkedByEntry.get(entry.id) ?? [],
  }))
}

export function getEssayEntries(db: AppDatabase, goalId: string): EssayEntry[] {
  const rows = db
    .select()
    .from(dailyEntries)
    .where(and(
      eq(dailyEntries.goalId, goalId),
      isNull(dailyEntries.deletedAt),
      sql`length(trim(${dailyEntries.reflection})) > 0`,
    ))
    .orderBy(asc(dailyEntries.entryDate))
    .all()

  if (rows.length === 0) return []

  const byId = new Map(rows.map(row => [row.id, row]))
  const links = db
    .select()
    .from(entryLinks)
    .where(or(
      inArray(entryLinks.sourceEntryId, rows.map(row => row.id)),
      inArray(entryLinks.targetEntryId, rows.map(row => row.id)),
    ))
    .all()

  const outgoing = new Map<string, DailyEntryRow[]>()
  const incoming = new Map<string, DailyEntryRow[]>()

  for (const link of links) {
    const source = byId.get(link.sourceEntryId)
    const target = byId.get(link.targetEntryId)
    if (!source || !target) continue

    outgoing.set(source.id, [...(outgoing.get(source.id) ?? []), target])
    incoming.set(target.id, [...(incoming.get(target.id) ?? []), source])
  }

  return rows
    .map(row => ({
      entry: toDailyEntry(row),
      outgoing: (outgoing.get(row.id) ?? [])
        .sort((a, b) => a.entryDate.localeCompare(b.entryDate))
        .map(toReference),
      incoming: (incoming.get(row.id) ?? [])
        .sort((a, b) => a.entryDate.localeCompare(b.entryDate))
        .map(toReference),
    }))
    .reverse()
}
