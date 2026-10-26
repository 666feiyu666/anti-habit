import { existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../database/schema'

export type AppDatabase = BetterSQLite3Database<typeof schema>

interface DatabaseHolder {
  db: AppDatabase
  client: Database.Database
}

const globalForDatabase = globalThis as typeof globalThis & {
  __antiHabitDatabase?: DatabaseHolder
}

/**
 * `nuxt preview` 会把工作目录切到 `.output`，而 `nuxt dev` 和
 * `node .output/server/index.mjs` 在项目根运行。相对路径统一按项目根解析，
 * 避免 preview 打开 `.output/.data` 下的另一份空库。
 */
export function resolveProjectRoot(cwd = process.cwd()): string {
  return basename(cwd) === '.output' ? dirname(cwd) : cwd
}

function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_URL?.trim()
  const projectRoot = resolveProjectRoot()
  if (!configured) return resolve(projectRoot, '.data/anti-habit.db')
  if (configured === ':memory:') return configured
  if (configured.startsWith('file:')) {
    const path = configured.slice('file:'.length)
    return isAbsolute(path) ? path : resolve(projectRoot, path)
  }
  return isAbsolute(configured) ? configured : resolve(projectRoot, configured)
}

function resolveMigrationsFolder(): string {
  const projectRoot = resolveProjectRoot()
  const candidates = [
    process.env.DATABASE_MIGRATIONS_PATH,
    resolve(projectRoot, 'server/database/migrations'),
  ].filter((candidate): candidate is string => Boolean(candidate))

  const folder = candidates.find(candidate =>
    existsSync(join(candidate, 'meta', '_journal.json')),
  )

  if (!folder) {
    throw new Error(
      '找不到 Drizzle migration 目录。请运行 `pnpm db:generate`，'
      + '或通过 DATABASE_MIGRATIONS_PATH 指定目录。',
    )
  }

  return folder
}

function createDatabase(): DatabaseHolder {
  const path = resolveDatabasePath()
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })

  const client = new Database(path)
  client.pragma('journal_mode = WAL')
  client.pragma('foreign_keys = ON')

  const db = drizzle(client, { schema })
  migrate(db, { migrationsFolder: resolveMigrationsFolder() })

  return { db, client }
}

export function getDatabase(): AppDatabase {
  if (!globalForDatabase.__antiHabitDatabase) {
    globalForDatabase.__antiHabitDatabase = createDatabase()
  }
  return globalForDatabase.__antiHabitDatabase.db
}

export function getDatabaseClient(): Database.Database {
  getDatabase()
  return globalForDatabase.__antiHabitDatabase!.client
}
