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

export type GoalTargetType = 'streak' | 'cumulative'

export interface GoalTargetProgress {
  startDate: string
  completedDays: number
  currentStreak: number
  longestStreak: number
  achieved: boolean
  achievedOn: string | null
}

export interface GoalTarget {
  id: string
  goalId: string
  type: GoalTargetType
  count: number
  createdAt: number
  updatedAt: number
  progress: GoalTargetProgress
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

export interface GoalMaterialSummary {
  id: string
  goalId: string
  title: string
  sourceName: string | null
  characterCount: number
  createdAt: number
  updatedAt: number
}

export interface GoalMaterial extends Omit<GoalMaterialSummary, 'characterCount'> {
  content: string
}
