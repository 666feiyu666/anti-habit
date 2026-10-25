export type EntryStatus = 'completed' | 'missed'

export interface Goal {
  id: string
  title: string
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

export interface GoalSummary extends Goal {
  todayEntry: DailyEntry | null
}
