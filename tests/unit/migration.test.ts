import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { describe, expect, it } from 'vitest'

const migrationsRoot = join(process.cwd(), 'server/database/migrations')

async function copyMigrations(target: string, tags: string[]) {
  await mkdir(join(target, 'meta'), { recursive: true })

  const journal = JSON.parse(
    await readFile(join(migrationsRoot, 'meta/_journal.json'), 'utf8'),
  ) as { entries: Array<{ tag: string }> }

  journal.entries = journal.entries.filter(entry => tags.includes(entry.tag))

  await writeFile(join(target, 'meta/_journal.json'), JSON.stringify(journal))
  for (const entry of journal.entries) {
    const sql = await readFile(join(migrationsRoot, `${entry.tag}.sql`), 'utf8')
    await writeFile(join(target, `${entry.tag}.sql`), sql)
  }
}

describe('database migrations', () => {
  it('applies V2 without changing existing goals and entries', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'anti-habit-migration-'))
    const migrationsFolder = join(folder, 'migrations')
    const sqlite = new Database(join(folder, 'test.db'))

    try {
      await copyMigrations(migrationsFolder, ['0000_init'])
      migrate(drizzle(sqlite), { migrationsFolder })

      sqlite.exec(`
        insert into goals (id, title, created_at, updated_at)
        values ('goal-1', 'Walk 20 Minutes', 100, 100);

        insert into daily_entries (
          id, goal_id, entry_date, status, reflection, created_at, updated_at
        ) values (
          'entry-1', 'goal-1', '2026-07-14', 'missed', '旧记录', 100, 100
        );
      `)

      await copyMigrations(migrationsFolder, ['0000_init', '0001_essays'])
      migrate(drizzle(sqlite), { migrationsFolder })

      const goal = sqlite
        .prepare('select id, title, essay_title, created_at from goals where id = ?')
        .get('goal-1') as {
          id: string
          title: string
          essay_title: string | null
          created_at: number
        }
      expect(goal).toEqual({
        id: 'goal-1',
        title: 'Walk 20 Minutes',
        essay_title: null,
        created_at: 100,
      })

      const entry = sqlite
        .prepare('select id, reflection, deleted_at from daily_entries where id = ?')
        .get('entry-1') as {
          id: string
          reflection: string | null
          deleted_at: number | null
        }
      expect(entry).toEqual({
        id: 'entry-1',
        reflection: '旧记录',
        deleted_at: null,
      })

      const goalColumns = sqlite
        .prepare('pragma table_info(goals)')
        .all() as Array<{ name: string }>
      expect(goalColumns.map(column => column.name)).toContain('essay_title')

      const entryColumns = sqlite
        .prepare('pragma table_info(daily_entries)')
        .all() as Array<{ name: string }>
      expect(entryColumns.map(column => column.name)).toContain('deleted_at')

      const tables = sqlite
        .prepare("select name from sqlite_master where type = 'table'")
        .all() as Array<{ name: string }>
      expect(tables.map(table => table.name)).toContain('entry_links')
    } finally {
      sqlite.close()
    }
  })
})
