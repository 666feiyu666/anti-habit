import type { DayAppearance } from '#shared/utils/day-appearance'

export const dayStatusLabel: Record<DayAppearance, string> = {
  completed: '今天完成',
  missed: '今天未完成',
  'reflected-miss': '今天未完成，有记录',
  unrecorded: '今天还没有记录',
}

export const dayStatusDot: Record<DayAppearance, string> = {
  completed: 'bg-done',
  missed: 'bg-miss',
  'reflected-miss': 'bg-mist ring-1 ring-inset ring-[#b7cfb6]',
  unrecorded: 'bg-transparent ring-1 ring-inset ring-rule-strong',
}
