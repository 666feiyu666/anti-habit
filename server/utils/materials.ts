import { and, desc, eq, sql } from 'drizzle-orm'
import type { GoalMaterialSummary } from '~~/shared/types'
import { goalMaterials, type GoalMaterialRow } from '../database/schema'
import type { AppDatabase } from './db'
import { apiError } from './http'

export function getMaterialSummaries(
  db: AppDatabase,
  goalId: string,
): GoalMaterialSummary[] {
  return db
    .select({
      id: goalMaterials.id,
      goalId: goalMaterials.goalId,
      title: goalMaterials.title,
      sourceName: goalMaterials.sourceName,
      characterCount: sql<number>`length(${goalMaterials.content})`,
      createdAt: goalMaterials.createdAt,
      updatedAt: goalMaterials.updatedAt,
    })
    .from(goalMaterials)
    .where(eq(goalMaterials.goalId, goalId))
    .orderBy(desc(goalMaterials.createdAt), desc(goalMaterials.id))
    .all()
}

export function requireMaterial(
  db: AppDatabase,
  goalId: string,
  materialId: string | undefined,
): GoalMaterialRow {
  if (!materialId) {
    throw apiError(404, 'MATERIAL_NOT_FOUND', '材料不存在')
  }

  const [material] = db
    .select()
    .from(goalMaterials)
    .where(and(
      eq(goalMaterials.id, materialId),
      eq(goalMaterials.goalId, goalId),
    ))
    .limit(1)
    .all()

  if (!material) {
    throw apiError(404, 'MATERIAL_NOT_FOUND', '材料不存在')
  }

  return material
}
