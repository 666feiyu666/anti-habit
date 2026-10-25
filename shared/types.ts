export type EntryStatus = 'completed' | 'missed'

export interface Goal {
  id: string
  title: string
  essayTitle: string | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface DailyEntry {
  id: string
  goalId: string
  entryDate: string
  status: EntryStatus
  reflection: string | null
  createdAt: number
  updatedAt: number
}

export interface DailyEntryWithLinks extends DailyEntry {
  linkedEntryIds: string[]
}

export interface GoalSummary extends Goal {
  todayEntry: DailyEntry | null
}

export interface EssayReference {
  entryId: string
  entryDate: string
  status: EntryStatus
  excerpt: string
}

export interface EssayEntry {
  entry: DailyEntry
  outgoing: EssayReference[]
  incoming: EssayReference[]
}

export interface ImportedEssayEntry {
  entryDate: string
  status: EntryStatus
  reflection: string
  linkedEntryDates: string[]
}
