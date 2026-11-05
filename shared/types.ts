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
  reward: string | null
  rewardClaimedAt: number | null
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

/** 笔记直接关联的习惯。已删除的习惯仍保留标题，供历史笔记标注。 */
export interface MemoGoalRef {
  id: string
  title: string
  deletedAt: number | null
}

/** 笔记关联的具体打卡。软删除的打卡不出现在这里，ID 放在 hiddenEntryIds。 */
export interface MemoEntryRef {
  id: string
  entryDate: string
  goalId: string
  goalTitle: string
  goalDeletedAt: number | null
}

export interface Memo {
  id: string
  content: string
  createdAt: number
  updatedAt: number
  goals: MemoGoalRef[]
  entries: MemoEntryRef[]
  /** 关联过但打卡已软删除的记录；保存时服务端会保留这些关系。 */
  hiddenEntryIds: string[]
}

export interface FeedMemoItem extends Memo {
  kind: 'memo'
}

export interface FeedReflectionItem {
  kind: 'daily_reflection'
  id: string
  content: string
  createdAt: number
  updatedAt: number
  entryDate: string
  goalId: string
  goalTitle: string
  goalDeletedAt: number | null
}

export type FeedItem = FeedMemoItem | FeedReflectionItem

export interface FeedPage {
  items: FeedItem[]
  nextCursor: string | null
}

export interface MemoPage {
  memos: Memo[]
  nextCursor: string | null
}

export type FeedLinkedFilter = 'all' | 'linked' | 'unlinked'

export interface GoalRelatedMemos {
  memos: Memo[]
  reflections: DailyEntryWithLinks[]
}

/** 客户端用于选择“关联某次打卡”的轻量条目。 */
export interface CheckInOption {
  id: string
  goalId: string
  goalTitle: string
  entryDate: string
  status: EntryStatus
  excerpt: string
}
