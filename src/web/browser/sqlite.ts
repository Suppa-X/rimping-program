// node:sqlite DatabaseSync on top of sql.js (SQLite compiled to WebAssembly), for the in-browser demo.
import type { Database, SqlJsStatic, SqlValue } from 'sql.js'

let SQL: SqlJsStatic

export function useSqlJs(lib: SqlJsStatic): void {
  SQL = lib
}

const bindable = (params: unknown[]): SqlValue[] => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : (p as SqlValue)))

export class DatabaseSync {
  private db: Database

  constructor(_file: string) {
    this.db = new SQL.Database()
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  prepare(sql: string) {
    const db = this.db
    const rows = (params: unknown[], limit = Infinity): Record<string, unknown>[] => {
      const st = db.prepare(sql)
      try {
        if (params.length) st.bind(bindable(params))
        const out: Record<string, unknown>[] = []
        while (out.length < limit && st.step()) out.push(st.getAsObject())
        return out
      } finally {
        st.free()
      }
    }
    return {
      all: (...params: unknown[]) => rows(params),
      get: (...params: unknown[]) => rows(params, 1)[0],
      run: (...params: unknown[]) => {
        rows(params)
        return { changes: db.getRowsModified(), lastInsertRowid: 0 }
      }
    }
  }
}
