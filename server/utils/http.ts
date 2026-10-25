import type { H3Event } from 'h3'
import { createError, readBody } from 'h3'
import { z } from 'zod'
import { ENTRIES_RANGE_MAX_DAYS } from '~~/shared/schemas'
import { daysBetweenDateOnly, isValidDateOnly } from '~~/shared/utils/date'

export interface ApiErrorBody {
  code: string
  message: string
}

export function apiError(statusCode: number, code: string, message: string) {
  return createError({
    statusCode,
    statusMessage: message,
    data: { code, message } satisfies ApiErrorBody,
  })
}

export async function parseBody<S extends z.ZodType>(
  event: H3Event,
  schema: S,
): Promise<z.output<S>> {
  let body: unknown
  try {
    body = await readBody(event)
  } catch {
    throw apiError(400, 'INVALID_JSON', '请求内容不是合法的 JSON')
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    const message = result.error.issues[0]?.message || '请求内容无效'
    throw apiError(400, 'INVALID_INPUT', message)
  }

  return result.data
}

export function readDateQuery(value: unknown, field: string): string {
  if (typeof value !== 'string' || !isValidDateOnly(value)) {
    throw apiError(400, 'INVALID_DATE', `${field} 必须是有效的 YYYY-MM-DD 日期`)
  }
  return value
}

export function readDateParam(event: H3Event): string {
  const value = getRouterParam(event, 'date')
  if (!value || !isValidDateOnly(value)) {
    throw apiError(400, 'INVALID_DATE', '日期必须是有效的 YYYY-MM-DD 格式')
  }
  return value
}

export function readDateRange(event: H3Event): { from: string; to: string } {
  const query = getQuery(event)
  const from = readDateQuery(query.from, 'from')
  const to = readDateQuery(query.to, 'to')
  const span = daysBetweenDateOnly(from, to)

  if (span === null || span < 0) {
    throw apiError(400, 'INVALID_RANGE', '结束日期不能早于开始日期')
  }

  if (span + 1 > ENTRIES_RANGE_MAX_DAYS) {
    throw apiError(400, 'RANGE_TOO_LARGE', `一次最多查询 ${ENTRIES_RANGE_MAX_DAYS} 天`)
  }

  return { from, to }
}
