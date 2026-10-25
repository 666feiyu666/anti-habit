import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function formatDayNumber(date: string): string {
  return format(parseISO(date), 'd')
}

export function formatMonthName(date: string): string {
  return format(parseISO(date), 'M月')
}

export function formatWeekday(date: string): string {
  return format(parseISO(date), 'EEEE', { locale: zhCN })
}

export function formatFullDayLabel(date: string): string {
  return format(parseISO(date), 'yyyy年M月d日 EEEE', { locale: zhCN })
}

export function formatMonthLabel(anchor: Date): string {
  return format(anchor, 'yyyy年M月')
}

export function formatDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}
