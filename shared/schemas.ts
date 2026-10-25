import { z } from 'zod'

export const GOAL_TITLE_MAX_LENGTH = 80
export const REFLECTION_MAX_LENGTH = 10_000
export const ENTRIES_RANGE_MAX_DAYS = 366

export const goalTitleSchema = z
  .string()
  .trim()
  .min(1, '目标名称不能为空')
  .max(GOAL_TITLE_MAX_LENGTH, `目标名称不能超过 ${GOAL_TITLE_MAX_LENGTH} 个字符`)

export const createGoalSchema = z.object({
  title: goalTitleSchema,
})

export const updateGoalSchema = createGoalSchema

export const entryStatusSchema = z.enum(
  ['completed', 'missed'],
  '请选择完成或未完成',
)

export const upsertEntrySchema = z.object({
  status: entryStatusSchema,
  reflection: z
    .string()
    .max(REFLECTION_MAX_LENGTH, `Reflection 不能超过 ${REFLECTION_MAX_LENGTH} 个字符`)
    .nullish(),
}).transform(({ status, reflection }) => {
  const trimmed = reflection?.trim()
  return {
    status,
    reflection: trimmed ? trimmed : null,
  }
})

export const dateOnlySchema = z
  .string()
  .refine(value => /^\d{4}-\d{2}-\d{2}$/.test(value), '日期格式必须是 YYYY-MM-DD')
