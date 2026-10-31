import { z } from 'zod'

export const GOAL_TITLE_MAX_LENGTH = 80
export const ESSAY_TITLE_MAX_LENGTH = 120
export const REFLECTION_MAX_LENGTH = 10_000
export const ENTRIES_RANGE_MAX_DAYS = 366
export const MATERIAL_TITLE_MAX_LENGTH = 200
export const MATERIAL_SOURCE_NAME_MAX_LENGTH = 255
export const MATERIAL_CONTENT_MAX_LENGTH = 2_000_000

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

export const materialTitleSchema = z
  .string()
  .trim()
  .min(1, '材料标题不能为空')
  .max(MATERIAL_TITLE_MAX_LENGTH, `材料标题不能超过 ${MATERIAL_TITLE_MAX_LENGTH} 个字符`)

export const materialContentSchema = z
  .string()
  .refine(
    value => value.replace(/^\uFEFF/, '').trim().length > 0,
    '材料正文不能为空',
  )
  .refine(
    value => value.length <= MATERIAL_CONTENT_MAX_LENGTH,
    `材料正文不能超过 ${MATERIAL_CONTENT_MAX_LENGTH} 个字符`,
  )
  .transform(value => value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'))

export const materialSourceNameSchema = z
  .string()
  .trim()
  .max(
    MATERIAL_SOURCE_NAME_MAX_LENGTH,
    `文件名不能超过 ${MATERIAL_SOURCE_NAME_MAX_LENGTH} 个字符`,
  )
  .nullish()
  .transform(value => value ? value : null)

export const createMaterialSchema = z.object({
  title: materialTitleSchema.optional(),
  content: materialContentSchema,
  sourceName: materialSourceNameSchema,
}).transform(({ title, content, sourceName }) => ({
  title: title || materialTitleFromSourceName(sourceName),
  content,
  sourceName,
}))

export const updateMaterialSchema = z.object({
  title: materialTitleSchema,
  content: materialContentSchema,
})

export function materialTitleFromSourceName(sourceName: string | null | undefined): string {
  if (!sourceName) return '未命名材料'

  const withoutPath = sourceName.split(/[\\/]/).pop() ?? sourceName
  const withoutExtension = withoutPath.replace(/\.(?:md|markdown|txt)$/i, '').trim()
  return withoutExtension || '未命名材料'
}

export const GOAL_TARGET_COUNT_MIN = 1
export const GOAL_TARGET_COUNT_MAX = 3650

export const goalTargetTypeSchema = z.enum(
  ['streak', 'cumulative'],
  '请选择连续或累积',
)

export const goalTargetCountSchema = z
  .number()
  .int('天数必须是整数')
  .min(GOAL_TARGET_COUNT_MIN, `目标天数至少为 ${GOAL_TARGET_COUNT_MIN} 天`)
  .max(GOAL_TARGET_COUNT_MAX, `目标天数不能超过 ${GOAL_TARGET_COUNT_MAX} 天`)

export const createGoalTargetSchema = z.object({
  type: goalTargetTypeSchema,
  count: goalTargetCountSchema,
})

export const updateGoalTargetSchema = createGoalTargetSchema
