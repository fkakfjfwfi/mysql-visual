import type { SqlValue, Table } from './types'
import { SEED_SQL } from './seed'

type ResultSet = { columns: string[]; values: SqlValue[][] }

export type SqlModule = {
  Database: new (data?: ArrayLike<number> | null) => {
    exec: (sql: string) => ResultSet[]
    export: () => Uint8Array
    close: () => void
  }
}

export type Engine = {
  query: (sql: string) => Table
}

export function engineFrom(SQL: SqlModule): Engine {
  const seeded = new SQL.Database()
  seeded.exec(SEED_SQL)
  const seed = seeded.export()
  seeded.close()

  return {
    query(sql: string) {
      const text = sql.trim()
      if (!text) throw new Error('先写一句 SELECT。')
      const db = new SQL.Database(seed)
      try {
        let results: ResultSet[]
        try {
          results = db.exec(text)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          throw new Error(message)
        }
        const table = results.find((item) => item.columns.length > 0)
        if (!table) return { columns: [], rows: [] }
        return {
          columns: table.columns,
          rows: table.values.map((row) => row.map((value) => (value instanceof Uint8Array ? null : value))),
        }
      } finally {
        db.close()
      }
    },
  }
}
