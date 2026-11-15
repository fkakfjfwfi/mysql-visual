import initSqlJs from 'sql.js'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lessons } from './lessons'
import { engineFrom } from './sql/engine'
import { grade } from './sql/grade'
import { parseSelect } from './sql/parse'
import { buildPipeline } from './sql/pipeline'

const wasm = readFileSync(new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url))
const SQL = await initSqlJs({ wasmBinary: wasm.buffer as ArrayBuffer })
const engine = engineFrom(SQL)

describe('青禾书店课程', () => {
  it('有 15 课，每课 3 道小题，示例和答案都能跑过', () => {
    expect(lessons).toHaveLength(15)
    for (const lesson of lessons) {
      expect(lesson.challenges).toHaveLength(3)
      const starter = engine.query(lesson.starterSql)
      expect(starter.columns.length).toBeGreaterThan(0)
      for (const challenge of lesson.challenges) {
        const expected = engine.query(challenge.expectedSql)
        expect(expected.rows.length).toBeGreaterThan(0)
        expect(grade(expected, expected, challenge.orderMatters).ok).toBe(true)
      }
    }
  })

  it('列顺序不同也可以算对，排序题则不行', () => {
    const expected = engine.query('SELECT title, price FROM books ORDER BY price;')
    const swapped = {
      columns: [...expected.columns].reverse(),
      rows: expected.rows.map((row) => [...row].reverse()),
    }
    expect(grade(swapped, expected, false).ok).toBe(true)
    const reversed = { columns: expected.columns, rows: [...expected.rows].reverse() }
    expect(grade(reversed, expected, true).reason).toBe('内容对了，但顺序不同')
  })

  it('杭州这一课会把其余顾客留在原处变淡', () => {
    const pipeline = buildPipeline("SELECT name, city FROM customers WHERE city = '杭州';", engine.query)
    const filter = pipeline.stages.find((stage) => stage.kind === 'rows' && stage.title === '按条件留下')
    expect(filter?.kind).toBe('rows')
    if (filter?.kind !== 'rows') return
    expect(filter.cards.filter((card) => card.state === 'kept')).toHaveLength(2)
    expect(filter.cards.filter((card) => card.state === 'dropped')).toHaveLength(8)
  })

  it('内联结画出订单和顾客之间的连线', () => {
    const pipeline = buildPipeline(lessons[12].starterSql, engine.query)
    const join = pipeline.stages.find((stage) => stage.kind === 'join')
    expect(join?.kind).toBe('join')
    if (join?.kind !== 'join') return
    expect(join.links.filter((link) => link.state === 'kept')).toHaveLength(10)
    expect(join.right.filter((card) => card.state === 'dropped')).toHaveLength(2)
  })

  it('分组把同一个城市叠成一摞，HAVING 会让人数不够的摞变淡', () => {
    const grouped = buildPipeline(lessons[9].starterSql, engine.query)
    const piles = grouped.stages.find((stage) => stage.kind === 'groups')
    expect(piles?.kind).toBe('groups')
    if (piles?.kind !== 'groups') return
    expect(piles.piles).toHaveLength(7)
    expect(piles.piles.find((pile) => pile.label === '杭州')?.cards).toHaveLength(2)

    const having = buildPipeline(lessons[10].starterSql, engine.query)
    const filtered = having.stages.find((stage) => stage.kind === 'groups')
    if (filtered?.kind !== 'groups') throw new Error('缺少分组')
    expect(filtered.piles.filter((pile) => pile.state === 'kept')).toHaveLength(3)
    expect(filtered.piles.find((pile) => pile.label === '空')?.state).toBe('dropped')
  })

  it('子查询先算出平均价，再送进外层', () => {
    const pipeline = buildPipeline(lessons[11].starterSql, engine.query)
    expect(pipeline.subqueries).toHaveLength(1)
    expect(pipeline.subqueries[0].values).toHaveLength(1)
    const filter = pipeline.stages.find((stage) => stage.kind === 'rows' && stage.title === '按条件留下')
    if (filter?.kind !== 'rows') throw new Error('缺少过滤')
    expect(filter.cards.filter((card) => card.state === 'kept').length).toBeGreaterThan(0)
    expect(filter.cards.some((card) => card.state === 'dropped')).toBe(true)
  })

  it('字符串里的 FROM 不会被当成从句', () => {
    expect(parseSelect("SELECT title FROM books WHERE title = 'FROM';")?.where).toBe("title = 'FROM'")
  })

  it('左联结留下没有订单的顾客', () => {
    const pipeline = buildPipeline(lessons[14].starterSql, engine.query)
    const join = pipeline.stages.find((stage) => stage.kind === 'join')
    if (join?.kind !== 'join') throw new Error('缺少联结')
    const unmatched = join.left.filter((card) => card.note === '没有对上')
    expect(unmatched.map((card) => card.fields.find((field) => field.name === 'name')?.value).sort()).toEqual(['丁舟', '许安'])
    expect(join.left.every((card) => card.state === 'kept')).toBe(true)
  })
})
