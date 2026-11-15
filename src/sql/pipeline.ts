import { formatValue } from './format'
import { parseSelect, qualifier, renderFrom, tableLabel } from './parse'
import type { Engine } from './engine'
import type { Card, Field, ParsedSelect, PipelineModel, SqlValue, Stage, Table, TableRef } from './types'

type Runner = Engine['query']

const CARD_CAP = 36

function capCards(cards: Card[]): { cards: Card[]; hidden: number } {
  if (cards.length <= CARD_CAP) return { cards, hidden: 0 }
  return { cards: cards.slice(0, CARD_CAP), hidden: cards.length - CARD_CAP }
}

function fieldsOf(columns: string[], values: SqlValue[], skip: Set<string>): Field[] {
  return columns.flatMap((name, index) => (skip.has(name) ? [] : [{ name, value: formatValue(values[index]) }]))
}

function rowCards(table: Table, prefix: string): Card[] {
  const ridIndex = table.columns.indexOf('__rid')
  return table.rows.map((values) => {
    const rid = ridIndex >= 0 ? values[ridIndex] : values[0]
    return {
      id: `${prefix}:${String(rid)}`,
      fields: fieldsOf(table.columns, values, new Set(['__rid'])),
      state: 'kept' as const,
    }
  })
}

function loadCards(run: Runner, table: TableRef): Card[] {
  const name = qualifier(table)
  const listed = run(`SELECT ${name}.rowid AS __rid, * FROM ${renderFrom(table, [])}`)
  return rowCards(listed, name)
}

function whereSql(where: string | null): string {
  return where ? ` WHERE ${where}` : ''
}

function isPlainStar(query: ParsedSelect): boolean {
  if (query.distinct || query.columns.length !== 1) return false
  const sql = query.columns[0].sql.replaceAll(/\s/g, '')
  return sql === '*' || sql.endsWith('.*')
}

function parseLimit(limit: string | null): { count: number; offset: number } | null {
  if (!limit) return null
  const text = limit.trim()
  const offsetForm = text.match(/^(\d+)\s+OFFSET\s+(\d+)$/i)
  if (offsetForm) return { count: Number(offsetForm[1]), offset: Number(offsetForm[2]) }
  const commaForm = text.match(/^(\d+)\s*,\s*(\d+)$/)
  if (commaForm) return { offset: Number(commaForm[1]), count: Number(commaForm[2]) }
  const countForm = text.match(/^(\d+)$/)
  if (countForm) return { count: Number(countForm[1]), offset: 0 }
  return null
}

function splitKeys(groupBy: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < groupBy.length; i += 1) {
    const ch = groupBy[i]
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    else if (ch === ',' && depth === 0) {
      parts.push(groupBy.slice(start, i).trim())
      start = i + 1
    }
  }
  parts.push(groupBy.slice(start).trim())
  return parts.filter(Boolean)
}

function projectionStage(query: ParsedSelect, run: Runner, fromSql: string): Stage | null {
  const needed = !isPlainStar(query) || Boolean(query.orderBy || query.limit || query.distinct)
  if (!needed || query.groupBy) return null
  const columns = query.distinct ? `DISTINCT ${query.columnsSql}` : query.columnsSql
  let sql = `SELECT ${columns} FROM ${fromSql}${whereSql(query.where)}`
  if (query.orderBy) sql += ` ORDER BY ${query.orderBy}`
  const ordered = run(sql)
  const limit = parseLimit(query.limit)
  let keptRank = 0
  const cards: Card[] = ordered.rows.map((values, index) => {
    const dropped = limit ? index < limit.offset || index >= limit.offset + limit.count : false
    if (!dropped && query.orderBy) keptRank += 1
    return {
      id: `out:${index}`,
      fields: fieldsOf(ordered.columns, values, new Set()),
      state: dropped ? 'dropped' : 'kept',
      rank: !dropped && query.orderBy ? keptRank : undefined,
    }
  })
  const shown = capCards(cards)
  const kept = cards.filter((card) => card.state === 'kept').length
  return {
    kind: 'rows',
    title: query.orderBy ? '选出并排序' : '选出这些列',
    detail: query.limit ? `留下 ${kept} 行` : `${cards.length} 行`,
    cards: shown.cards,
    hidden: shown.hidden,
  }
}

function groupStage(query: ParsedSelect, run: Runner, fromSql: string, qual: string | null): Stage {
  const keys = splitKeys(query.groupBy ?? '')
  const keySelect = keys.map((key, index) => `(${key}) AS __k${index}`).join(', ')
  const grouped = run(
    `SELECT ${keySelect}, ${query.columnsSql} FROM ${fromSql}${whereSql(query.where)} GROUP BY ${query.groupBy}`,
  )
  const keptTable = run(
    `SELECT ${keySelect} FROM ${fromSql}${whereSql(query.where)} GROUP BY ${query.groupBy}${
      query.having ? ` HAVING ${query.having}` : ''
    }${query.orderBy ? ` ORDER BY ${query.orderBy}` : ''}`,
  )
  const keptKeys = keptTable.rows.map((row) => row.map((value) => formatValue(value)).join(' · '))
  const keptSet = new Set(keptKeys)
  const rankOf = new Map(keptKeys.map((key, index) => [key, query.orderBy ? index + 1 : undefined]))

  const memberBuckets = new Map<string, Card[]>()
  if (qual) {
    const members = run(`SELECT ${qual}.rowid AS __rid, ${keySelect} FROM ${fromSql}${whereSql(query.where)}`)
    const full = run(`SELECT ${qual}.rowid AS __rid, * FROM ${fromSql}${whereSql(query.where)}`)
    const cards = new Map(rowCards(full, qual).map((card) => [card.id, card]))
    members.rows.forEach((row) => {
      const id = `${qual}:${String(row[0])}`
      const key = row.slice(1).map((value) => formatValue(value)).join(' · ')
      const card = cards.get(id)
      if (!card) return
      const list = memberBuckets.get(key) ?? []
      list.push(card)
      memberBuckets.set(key, list)
    })
  }

  const keyCount = keys.length
  const simpleNames = new Set(keys.map((key) => key.split('.').pop()?.replaceAll('`', '').toLowerCase() ?? key))
  const piles = grouped.rows.map((row) => {
    const key = row.slice(0, keyCount).map((value) => formatValue(value)).join(' · ')
    const summary = grouped.columns
      .slice(keyCount)
      .flatMap((name, index) => {
        if (simpleNames.has(name.toLowerCase())) return []
        return [`${name} ${formatValue(row[keyCount + index])}`]
      })
      .join(' · ')
    const state = keptSet.has(key) ? ('kept' as const) : ('dropped' as const)
    return {
      id: key || '空',
      label: key || '空',
      summary: summary || `${memberBuckets.get(key)?.length ?? 0} 行`,
      state,
      rank: state === 'kept' ? rankOf.get(key) : undefined,
      cards: (memberBuckets.get(key) ?? []).map((card) => ({ ...card, state })),
    }
  })
  piles.sort((a, b) => {
    if (a.state !== b.state) return a.state === 'kept' ? -1 : 1
    return (a.rank ?? 0) - (b.rank ?? 0)
  })
  const keptCount = piles.filter((pile) => pile.state === 'kept').length
  return {
    kind: 'groups',
    title: query.having ? '分组后再过滤' : '分组',
    detail: query.having ? `留下 ${keptCount} / ${piles.length} 摞` : `${piles.length} 摞`,
    piles,
  }
}

function singleStages(query: ParsedSelect, run: Runner): Stage[] {
  const qual = qualifier(query.base)
  const fromSql = renderFrom(query.base, [])
  const all = rowCards(run(`SELECT ${qual}.rowid AS __rid, * FROM ${fromSql}`), qual)
  const source = capCards(all)
  const stages: Stage[] = [
    {
      kind: 'rows',
      title: `取出 ${query.base.name}`,
      detail: `${all.length} 行`,
      cards: source.cards,
      hidden: source.hidden,
    },
  ]

  if (query.where) {
    const kept = run(`SELECT ${qual}.rowid AS __rid FROM ${fromSql} WHERE ${query.where}`)
    const keptIds = new Set(kept.rows.map((row) => `${qual}:${String(row[0])}`))
    const faded = all.map((card) => ({
      ...card,
      state: keptIds.has(card.id) ? ('kept' as const) : ('dropped' as const),
    }))
    const shown = capCards(faded)
    stages.push({
      kind: 'rows',
      title: '按条件留下',
      detail: `留下 ${keptIds.size} / ${all.length}`,
      cards: shown.cards,
      hidden: shown.hidden,
    })
  }

  if (query.groupBy) {
    stages.push(groupStage(query, run, fromSql, qual))
    return stages
  }

  const projected = projectionStage(query, run, fromSql)
  if (projected) stages.push(projected)
  return stages
}

function pairKey(left: SqlValue, right: SqlValue): string {
  return `${String(left)}|${String(right)}`
}

function joinStages(query: ParsedSelect, run: Runner): Stage[] {
  return query.joins.map((join, index) => {
    const leftRef = index === 0 ? query.base : query.joins[index - 1].table
    const rightRef = join.table
    const leftName = qualifier(leftRef)
    const rightName = qualifier(rightRef)
    const partial = renderFrom(query.base, query.joins, index + 1)
    const isLast = index === query.joins.length - 1
    const filter = isLast ? query.where : null
    const left = loadCards(run, leftRef)
    const right = loadCards(run, rightRef)
    const predicate = filter ? `(${filter}) AND ${rightName}.rowid IS NOT NULL` : `${rightName}.rowid IS NOT NULL`
    const solidRows = run(`SELECT DISTINCT ${leftName}.rowid AS __l, ${rightName}.rowid AS __r FROM ${partial} WHERE ${predicate}`)
    const onRows = run(
      `SELECT DISTINCT ${leftName}.rowid AS __l, ${rightName}.rowid AS __r FROM ${partial} WHERE ${rightName}.rowid IS NOT NULL`,
    )
    const solidKeys = new Set(solidRows.rows.map((row) => pairKey(row[0], row[1])))
    const links = onRows.rows.map((row) => {
      const key = pairKey(row[0], row[1])
      return {
        leftId: `${leftName}:${String(row[0])}`,
        rightId: `${rightName}:${String(row[1])}`,
        state: solidKeys.has(key) ? ('kept' as const) : ('dropped' as const),
      }
    })
    const solidLeft = new Set(links.filter((link) => link.state === 'kept').map((link) => link.leftId))
    const solidRight = new Set(links.filter((link) => link.state === 'kept').map((link) => link.rightId))
    let unmatchedKept = new Set<string>()
    if (join.kind === 'left') {
      const unmatched = run(
        `SELECT DISTINCT ${leftName}.rowid AS __l FROM ${partial} WHERE ${rightName}.rowid IS NULL${
          filter ? ` AND (${filter})` : ''
        }`,
      )
      unmatchedKept = new Set(unmatched.rows.map((row) => `${leftName}:${String(row[0])}`))
    }
    const leftCards = left.map((card) => ({
      ...card,
      state: solidLeft.has(card.id) || unmatchedKept.has(card.id) ? ('kept' as const) : ('dropped' as const),
      note: unmatchedKept.has(card.id) ? '没有对上' : undefined,
    }))
    const rightCards = right.map((card) => ({
      ...card,
      state: solidRight.has(card.id) ? ('kept' as const) : ('dropped' as const),
    }))
    const shownLeft = capCards(leftCards)
    const shownRight = capCards(rightCards)
    const visible = new Set([...shownLeft.cards, ...shownRight.cards].map((card) => card.id))
    const word = join.kind === 'left' ? '左联结' : '内联结'
    const keptLinks = links.filter((link) => link.state === 'kept').length
    return {
      kind: 'join' as const,
      title: query.joins.length > 1 ? `第 ${index + 1} 步 · ${word}` : word,
      detail: filter ? `对上并留下 ${keptLinks} 对` : `对上 ${keptLinks} 对`,
      leftTitle: tableLabel(leftRef),
      rightTitle: tableLabel(rightRef),
      left: shownLeft.cards,
      right: shownRight.cards,
      links: links.filter((link) => visible.has(link.leftId) && visible.has(link.rightId)),
      hidden: shownLeft.hidden + shownRight.hidden,
    }
  })
}

export function buildPipeline(sql: string, run: Runner, depth = 0): PipelineModel {
  if (depth > 2) {
    return { subqueries: [], stages: [], note: '子查询套得太深，这一层先不展开。' }
  }
  const parsed = parseSelect(sql)
  if (!parsed) {
    return { subqueries: [], stages: [], note: '这句还画不成流水线。结果表仍然按它计算。' }
  }
  if (parsed.joins.some((join) => join.kind === 'right')) {
    return { subqueries: [], stages: [], note: '右联结先不画成图。结果表仍然按它计算。' }
  }
  try {
    const subqueries =
      depth === 0
        ? parsed.subqueries.map((inner) => {
            const table = run(inner)
            const values = table.rows.slice(0, 12).map((row) => row.map((value) => formatValue(value)).join('，'))
            const nested = buildPipeline(inner, run, depth + 1)
            return { sql: inner, values, stages: nested.stages }
          })
        : []
    if (parsed.joins.length > 0) {
      const stages: Stage[] = joinStages(parsed, run)
      if (parsed.groupBy) stages.push(groupStage(parsed, run, renderFrom(parsed.base, parsed.joins), null))
      else {
        const projected = projectionStage(parsed, run, renderFrom(parsed.base, parsed.joins))
        if (projected) stages.push(projected)
      }
      return { subqueries, stages }
    }
    return { subqueries, stages: singleStages(parsed, run) }
  } catch {
    return { subqueries: [], stages: [], note: '这句能查出结果，但这张图还跟不上它。' }
  }
}
