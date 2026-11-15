import type { JoinKind, ParsedJoin, ParsedSelect, TableRef } from './types'

type Tok = {
  kind: 'kw' | 'id' | 'str' | 'num' | 'sym'
  value: string
  upper: string
  start: number
  end: number
}

const KEYWORDS = new Set([
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP',
  'BY',
  'HAVING',
  'ORDER',
  'LIMIT',
  'ASC',
  'DESC',
  'AS',
  'JOIN',
  'INNER',
  'LEFT',
  'RIGHT',
  'FULL',
  'OUTER',
  'ON',
  'AND',
  'OR',
  'NOT',
  'IN',
  'IS',
  'NULL',
  'BETWEEN',
  'LIKE',
  'DISTINCT',
  'CROSS',
  'OFFSET',
])

const SYMBOLS = new Set([...'.,;()=*<>!+-/%'])

function tokenize(sql: string): Tok[] | null {
  const tokens: Tok[] = []
  let i = 0
  while (i < sql.length) {
    const ch = sql[i]
    if (/\s/.test(ch)) {
      i += 1
      continue
    }
    if (ch === '-' && sql[i + 1] === '-') {
      i += 2
      while (i < sql.length && sql[i] !== '\n') i += 1
      continue
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      if (end < 0) return null
      i = end + 2
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      const start = i
      i += 1
      let value = ''
      while (i < sql.length) {
        if (sql[i] === quote && sql[i + 1] === quote) {
          value += quote
          i += 2
          continue
        }
        if (sql[i] === quote) {
          i += 1
          tokens.push({
            kind: quote === "'" ? 'str' : 'id',
            value,
            upper: value.toUpperCase(),
            start,
            end: i,
          })
          break
        }
        value += sql[i]
        i += 1
      }
      if (i > sql.length || sql[i - 1] !== quote) return null
      continue
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(sql[i + 1] ?? ''))) {
      const start = i
      i += 1
      while (i < sql.length && /[0-9.]/.test(sql[i])) i += 1
      const value = sql.slice(start, i)
      tokens.push({ kind: 'num', value, upper: value, start, end: i })
      continue
    }
    if (SYMBOLS.has(ch)) {
      const start = i
      let value = ch
      i += 1
      const two = value + (sql[i] ?? '')
      if (two === '>=' || two === '<=' || two === '<>' || two === '!=') {
        value = two
        i += 1
      }
      tokens.push({ kind: 'sym', value, upper: value, start, end: i })
      continue
    }
    const start = i
    i += 1
    while (i < sql.length && !/\s/.test(sql[i]) && !SYMBOLS.has(sql[i]) && sql[i] !== "'" && sql[i] !== '"' && sql[i] !== '`') {
      i += 1
    }
    const value = sql.slice(start, i)
    const upper = value.toUpperCase()
    tokens.push({
      kind: KEYWORDS.has(upper) ? 'kw' : 'id',
      value,
      upper,
      start,
      end: i,
    })
  }
  return tokens
}

function depthAt(tokens: Tok[], index: number): number {
  let depth = 0
  for (let i = 0; i < index; i += 1) {
    if (tokens[i].value === '(') depth += 1
    else if (tokens[i].value === ')') depth -= 1
  }
  return depth
}

function splitTopCommas(sql: string): string[] {
  const tokens = tokenize(sql)
  if (!tokens) return [sql.trim()]
  const parts: string[] = []
  let start = 0
  let depth = 0
  for (const token of tokens) {
    if (token.value === '(') depth += 1
    else if (token.value === ')') depth -= 1
    else if (token.value === ',' && depth === 0) {
      parts.push(sql.slice(start, token.start).trim())
      start = token.end
    }
  }
  parts.push(sql.slice(start).trim())
  return parts.filter(Boolean)
}

function columnAlias(expr: string): string | null {
  const tokens = tokenize(expr)
  if (!tokens || tokens.length < 2) return null
  let depth = 0
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].value === '(') depth += 1
    else if (tokens[i].value === ')') depth -= 1
  }
  if (depth !== 0) return null
  const last = tokens[tokens.length - 1]
  const prev = tokens[tokens.length - 2]
  if (last.kind !== 'id' && last.kind !== 'kw') return null
  if (prev.upper === 'AS' && depthOfToken(tokens, tokens.length - 1) === 0) return last.value
  return null
}

function depthOfToken(tokens: Tok[], index: number): number {
  return depthAt(tokens, index)
}

function readTable(tokens: Tok[], start: number): { table: TableRef; index: number } | null {
  const nameTok = tokens[start]
  if (!nameTok || (nameTok.kind !== 'id' && nameTok.kind !== 'kw')) return null
  let index = start + 1
  let name = nameTok.value
  if (tokens[index]?.value === '.' && tokens[index + 1]) {
    name = tokens[index + 1].value
    index += 2
  }
  let alias: string | null = null
  if (tokens[index]?.upper === 'AS' && tokens[index + 1]?.kind === 'id') {
    alias = tokens[index + 1].value
    index += 2
  } else if (
    tokens[index] &&
    tokens[index].kind === 'id' &&
    !['JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'OUTER', 'ON', 'WHERE', 'GROUP', 'ORDER', 'LIMIT', 'HAVING'].includes(tokens[index].upper)
  ) {
    alias = tokens[index].value
    index += 1
  }
  return { table: { name, alias }, index }
}

function parseFrom(fromSql: string): { base: TableRef; joins: ParsedJoin[] } | null {
  const tokens = tokenize(fromSql)
  if (!tokens) return null
  const baseRead = readTable(tokens, 0)
  if (!baseRead) return null
  const joins: ParsedJoin[] = []
  let i = baseRead.index
  while (i < tokens.length) {
    let kind: JoinKind = 'inner'
    if (['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'OUTER', 'JOIN'].includes(tokens[i]?.upper ?? '')) {
      const marks: string[] = []
      while (tokens[i] && tokens[i].upper !== 'JOIN') {
        if (!['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'OUTER'].includes(tokens[i].upper)) return null
        marks.push(tokens[i].upper)
        i += 1
      }
      if (tokens[i]?.upper !== 'JOIN') return null
      i += 1
      if (marks.includes('LEFT')) kind = 'left'
      else if (marks.includes('RIGHT') || marks.includes('FULL')) kind = 'right'
      else if (marks.includes('CROSS')) kind = 'cross'
      else kind = 'inner'
    } else if (tokens[i]?.value === ',') {
      i += 1
      kind = 'cross'
    } else {
      return null
    }
    const tableRead = readTable(tokens, i)
    if (!tableRead) return null
    i = tableRead.index
    let on: string | null = null
    if (tokens[i]?.upper === 'ON') {
      const exprStart = tokens[i].end
      i += 1
      let depth = 0
      while (i < tokens.length) {
        if (tokens[i].value === '(') depth += 1
        else if (tokens[i].value === ')') depth -= 1
        else if (depth === 0 && (tokens[i].upper === 'JOIN' || ['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS'].includes(tokens[i].upper) || tokens[i].value === ',')) {
          break
        }
        i += 1
      }
      const exprEnd = tokens[i - 1]?.end ?? exprStart
      on = fromSql.slice(exprStart, exprEnd).trim()
    }
    joins.push({ kind, table: tableRead.table, on })
  }
  return { base: baseRead.table, joins }
}

function extractSubqueries(sql: string): string[] {
  const tokens = tokenize(sql)
  if (!tokens) return []
  const found: string[] = []
  let depth = 0
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token.value === '(') {
      const next = tokens[i + 1]
      if (depth === 0 && next?.upper === 'SELECT') {
        let inner = 0
        let j = i
        for (; j < tokens.length; j += 1) {
          if (tokens[j].value === '(') inner += 1
          else if (tokens[j].value === ')') {
            inner -= 1
            if (inner === 0) break
          }
        }
        if (j < tokens.length) found.push(sql.slice(next.start, tokens[j].start).trim())
      }
      depth += 1
    } else if (token.value === ')') depth -= 1
  }
  return found
}

function sliceBetween(sql: string, from: number, to: number): string {
  return sql.slice(from, to).trim()
}

export function parseSelect(input: string): ParsedSelect | null {
  let sql = input.trim()
  if (sql.endsWith(';')) sql = sql.slice(0, -1).trim()
  if (!sql) return null
  const tokens = tokenize(sql)
  if (!tokens || tokens.length === 0 || tokens[0].upper !== 'SELECT') return null

  let index = 1
  let distinct = false
  if (tokens[index]?.upper === 'DISTINCT') {
    distinct = true
    index += 1
  }
  const selectTokenEnd = tokens[index - 1].end

  let fromAt = -1
  let depth = 0
  for (let i = index; i < tokens.length; i += 1) {
    if (tokens[i].value === '(') depth += 1
    else if (tokens[i].value === ')') depth -= 1
    else if (depth === 0 && tokens[i].upper === 'FROM') {
      fromAt = i
      break
    }
  }
  if (fromAt < 0) return null
  const columnsSql = sliceBetween(sql, selectTokenEnd, tokens[fromAt].start)
  if (!columnsSql) return null

  type Clause = 'where' | 'group' | 'having' | 'order' | 'limit'
  const marks: { clause: Clause; keywordEnd: number; tokenIndex: number }[] = []
  depth = 0
  for (let i = fromAt + 1; i < tokens.length; i += 1) {
    if (tokens[i].value === '(') depth += 1
    else if (tokens[i].value === ')') depth -= 1
    else if (depth === 0) {
      const upper = tokens[i].upper
      if (upper === 'WHERE') marks.push({ clause: 'where', keywordEnd: tokens[i].end, tokenIndex: i })
      else if (upper === 'GROUP' && tokens[i + 1]?.upper === 'BY') {
        marks.push({ clause: 'group', keywordEnd: tokens[i + 1].end, tokenIndex: i })
      } else if (upper === 'HAVING') marks.push({ clause: 'having', keywordEnd: tokens[i].end, tokenIndex: i })
      else if (upper === 'ORDER' && tokens[i + 1]?.upper === 'BY') {
        marks.push({ clause: 'order', keywordEnd: tokens[i + 1].end, tokenIndex: i })
      } else if (upper === 'LIMIT') marks.push({ clause: 'limit', keywordEnd: tokens[i].end, tokenIndex: i })
    }
  }

  const orderOk = ['where', 'group', 'having', 'order', 'limit']
  let last = -1
  for (const mark of marks) {
    const pos = orderOk.indexOf(mark.clause)
    if (pos < last) return null
    last = pos
  }

  const fromEnd = marks[0] ? tokens[marks[0].tokenIndex].start : sql.length
  const fromSql = sliceBetween(sql, tokens[fromAt].end, fromEnd)
  const parsedFrom = parseFrom(fromSql)
  if (!parsedFrom) return null

  const grab = (clause: Clause) => {
    const found = marks.findIndex((mark) => mark.clause === clause)
    if (found < 0) return null
    const start = marks[found].keywordEnd
    const end = marks[found + 1] ? tokens[marks[found + 1].tokenIndex].start : sql.length
    return sliceBetween(sql, start, end)
  }

  const columns = splitTopCommas(columnsSql).map((part) => ({
    sql: part,
    alias: columnAlias(part),
  }))

  return {
    sql,
    distinct,
    columnsSql,
    columns,
    fromSql,
    base: parsedFrom.base,
    joins: parsedFrom.joins,
    where: grab('where'),
    groupBy: grab('group'),
    having: grab('having'),
    orderBy: grab('order'),
    limit: grab('limit'),
    subqueries: extractSubqueries(sql),
  }
}

export function qualifier(table: TableRef): string {
  return table.alias ?? table.name
}

export function tableLabel(table: TableRef): string {
  return table.alias ? `${table.name} ${table.alias}` : table.name
}

export function renderTable(table: TableRef): string {
  return table.alias ? `${table.name} AS ${table.alias}` : table.name
}

export function renderFrom(base: TableRef, joins: ParsedJoin[], count = joins.length): string {
  let sql = renderTable(base)
  for (let i = 0; i < count; i += 1) {
    const join = joins[i]
    const word = join.kind === 'left' ? 'LEFT JOIN' : join.kind === 'cross' ? 'CROSS JOIN' : join.kind === 'right' ? 'RIGHT JOIN' : 'JOIN'
    sql += ` ${word} ${renderTable(join.table)}`
    if (join.on) sql += ` ON ${join.on}`
  }
  return sql
}
