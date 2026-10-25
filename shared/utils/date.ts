const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

interface DateParts {
  year: number
  month: number
  day: number
}

export function parseDateOnly(value: string): DateParts | null {
  const match = DATE_ONLY_PATTERN.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

export function isValidDateOnly(value: string): boolean {
  return parseDateOnly(value) !== null
}

/** Returns the browser/server local calendar day as `YYYY-MM-DD`. */
export function todayDateOnly(now = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Difference in calendar days, independent of daylight-saving changes. */
export function daysBetweenDateOnly(from: string, to: string): number | null {
  const start = parseDateOnly(from)
  const end = parseDateOnly(to)
  if (!start || !end) return null

  const startUtc = Date.UTC(start.year, start.month - 1, start.day)
  const endUtc = Date.UTC(end.year, end.month - 1, end.day)
  return Math.round((endUtc - startUtc) / 86_400_000)
}
