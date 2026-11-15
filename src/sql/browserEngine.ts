import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { engineFrom, type Engine } from './engine'

export async function createBrowserEngine(): Promise<Engine> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  return engineFrom(SQL)
}
