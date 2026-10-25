import { z } from 'zod'

export const GOAL_TITLE_MAX_LENGTH = 80
export const ESSAY_TITLE_MAX_LENGTH = 120
export const REFLECTION_MAX_LENGTH = 10_000
export const ENTRIES_RANGE_MAX_DAYS = 366

export const goalTitleSchema = z
  .string()
  .trim()
  .min(1, '目标名称不能为空')
  .max(GOAL_TITLE_MAX_LENGTH, `目标名称不能超过 ${GOAL_TITLE_MAX_LENGTH} 个字符`)

export const essayTitleSchema = z
  .string()
  .trim()
  .max(ESSAY_TITLE_MAX_LENGTH, `Essay 题目不能超过 ${ESSAY_TITLE_MAX_LENGTH} 个字符`)
  .nullable()
  .optional()
  .transform(value => value === undefined ? undefined : (value ? value : null))

export const createGoalSchema = z.object({
  title: goalTitleSchema,
  essayTitle: essayTitleSchema,
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
    .max(REFLECTION_MAX_LENGTH, `正文不能超过 ${REFLECTION_MAX_LENGTH} 个字符`)
    .nullish(),
  linkedEntryIds: z
    .array(z.string().trim().min(1, '关联的记录无效'))
    .optional(),
}).transform(({ status, reflection, linkedEntryIds }) => {
  const trimmed = reflection?.trim()
  return {
    status,
    reflection: trimmed ? trimmed : null,
    linkedEntryIds: linkedEntryIds ? [...new Set(linkedEntryIds)] : undefined,
  }
})

export const dateOnlySchema = z
  .string()
  .refine(value => /^\d{4}-\d{2}-\d{2}$/.test(value), '日期格式必须是 YYYY-MM-DD')
