import type { EntryStatus } from '../types'

export type DayAppearance = 'unrecorded' | 'completed' | 'missed' | 'reflected-miss'

export interface AppearanceEntry {
  status: EntryStatus
  reflection: string | null
}

/**
 * Maps a stored entry to its visual appearance. The database only stores the
 * behavioural fact; colour and texture are derived here so the theme can change
 * without a migration.
 */
export function getDayAppearance(entry?: AppearanceEntry | null): DayAppearance {
  if (!entry) return 'unrecorded'
  if (entry.status === 'completed') return 'completed'
  if (entry.reflection?.trim()) return 'reflected-miss'
  return 'missed'
}

export function hasReflection(entry?: AppearanceEntry | null): boolean {
  return Boolean(entry?.reflection?.trim())
}
