import { sameValue } from './format'
import type { SqlValue, Table } from './types'

export type Grade = {
  ok: boolean
  reason: string
}

export function grade(actual: Table, expected: Table, orderMatters: boolean): Grade {
  const actualNames = actual.columns.map((name) => name.toLowerCase())
  const expectedNames = expected.columns.map((name) => name.toLowerCase())

  if (new Set(actualNames).size !== actualNames.length) {
    return { ok: false, reason: '结果里有重复的列名' }
  }
  if (actualNames.length !== expectedNames.length || expectedNames.some((name) => !actualNames.includes(name))) {
    return { ok: false, reason: `列名要对上：${expected.columns.join('、')}` }
  }

  const indexes = expectedNames.map((name) => actualNames.indexOf(name))
  const actualRows = actual.rows.map((row) => indexes.map((index) => row[index]))
  const expectedRows = expected.rows

  if (actualRows.length !== expectedRows.length) {
    return {
      ok: false,
      reason: `行数不对：现在是 ${actualRows.length} 行，这题是 ${expectedRows.length} 行`,
    }
  }

  const equal = (left: SqlValue[], right: SqlValue[]) => left.every((value, index) => sameValue(value, right[index]))
  const bagMatches = () => {
    const used = expectedRows.map(() => false)
    return actualRows.every((row) => {
      const found = expectedRows.findIndex((candidate, index) => !used[index] && equal(row, candidate))
      if (found < 0) return false
      used[found] = true
      return true
    })
  }

  if (!orderMatters) {
    return bagMatches()
      ? { ok: true, reason: '对上了' }
      : { ok: false, reason: '有一行的内容和这题不一样' }
  }

  const sameOrder = actualRows.every((row, index) => equal(row, expectedRows[index]))
  if (sameOrder) return { ok: true, reason: '对上了' }
  if (bagMatches()) return { ok: false, reason: '内容对了，但顺序不同' }
  return { ok: false, reason: '有一行的内容和这题不一样' }
}
