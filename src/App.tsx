import { useEffect, useState } from 'react'
import { PipelineView } from './components/PipelineView'
import { lessonById, lessons, type Lesson } from './lessons'
import { useProgress } from './progress'
import { createBrowserEngine } from './sql/browserEngine'
import type { Engine } from './sql/engine'
import { formatValue } from './sql/format'
import { grade } from './sql/grade'
import { buildPipeline } from './sql/pipeline'
import { tables } from './sql/seed'
import type { PipelineModel, Table } from './sql/types'

const COLUMN_LABELS: Record<string, string> = {
  customer_id: '顾客编号',
  name: '姓名',
  city: '城市',
  book_id: '书号',
  title: '书名',
  author: '作者',
  price: '单价',
  order_id: '订单号',
  ordered_on: '下单日期',
  item_id: '明细号',
  quantity: '数量',
}

export function App() {
  const [engine, setEngine] = useState<Engine | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const store = useProgress()
  const [epoch, setEpoch] = useState(0)

  useEffect(() => {
    let cancelled = false
    createBrowserEngine()
      .then((next) => {
        if (!cancelled) setEngine(next)
      })
      .catch((error: unknown) => {
        if (!cancelled) setBootError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const lesson = lessonById(store.progress.lessonId)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <p className="mark">青禾书店</p>
          <h1>SQL 课</h1>
          <p className="brand-copy">改一句查询，看行怎么变化。</p>
        </div>
        <nav aria-label="课程">
          {lessons.map((item) => {
            const done = store.isComplete(item.id)
            const current = item.id === lesson.id
            return (
              <button
                key={item.id}
                type="button"
                className={current ? 'nav-item current' : 'nav-item'}
                onClick={() => store.setLessonId(item.id)}
                aria-current={current ? 'page' : undefined}
              >
                <span>{String(item.index).padStart(2, '0')}</span>
                <span>{item.title}</span>
                <span className={done ? 'dot done' : 'dot'} aria-label={done ? '已完成' : '未完成'} />
              </button>
            )
          })}
        </nav>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            store.reset()
            setEpoch((value) => value + 1)
          }}
        >
          清除进度和稿子
        </button>
      </aside>
      <main>
        {bootError ? <p className="error-banner">查询引擎没有准备好：{bootError}</p> : null}
        {!engine && !bootError ? <p className="loading">正在准备书店里的四张表…</p> : null}
        {engine ? <Studio key={`${lesson.id}-${epoch}`} engine={engine} lesson={lesson} store={store} /> : null}
      </main>
    </div>
  )
}

type Store = ReturnType<typeof useProgress>

function Studio({ engine, lesson, store }: { engine: Engine; lesson: Lesson; store: Store }) {
  const initial = store.progress.drafts[lesson.id] ?? lesson.starterSql
  const initialView = runView(engine, initial)
  const [sql, setSql] = useState(initial)
  const [runSql, setRunSql] = useState(initial)
  const [good, setGood] = useState(initialView.good)
  const [error, setError] = useState(initialView.error)
  const [showTables, setShowTables] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setRunSql(sql), 480)
    return () => window.clearTimeout(timer)
  }, [sql])

  useEffect(() => {
    try {
      const table = engine.query(runSql)
      const pipeline = buildPipeline(runSql, (statement) => engine.query(statement))
      setGood({ sql: runSql, table, pipeline })
      setError(null)
      for (const challenge of lesson.challenges) {
        const result = grade(table, engine.query(challenge.expectedSql), challenge.orderMatters)
        if (result.ok) store.markPassed(lesson.id, challenge.id)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
    // markPassed 用的是函数式更新；稿子变化不应立刻重跑查询。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, lesson, runSql])

  const showing = good
  const edited = sql.trim() !== lesson.starterSql.trim()
  const live = new Map(
    lesson.challenges.map((challenge) => {
      if (!showing || showing.sql !== runSql || error) return [challenge.id, null] as const
      return [challenge.id, grade(showing.table, engine.query(challenge.expectedSql), challenge.orderMatters)] as const
    }),
  )

  return (
    <article className="lesson">
      <header className="lesson-head">
        <p>第 {lesson.index} 课</p>
        <h2>{lesson.title}</h2>
        <p className="explanation">{lesson.explanation}</p>
      </header>

      <div className="workbench">
        <section className="editor-panel">
          <div className="panel-bar">
            <h3>查询</h3>
            <button
              type="button"
              onClick={() => {
                store.clearDraft(lesson.id)
                setSql(lesson.starterSql)
                setRunSql(lesson.starterSql)
              }}
            >
              回到示例
            </button>
          </div>
          <textarea
            aria-label="SQL 查询"
            spellCheck={false}
            value={sql}
            onChange={(event) => {
              const next = event.target.value
              setSql(next)
              store.setDraft(lesson.id, next)
            }}
          />
          {error ? (
            <p className="error-banner" role="alert">
              {error}
              {showing ? ' 图和表仍是上一句成功的查询。' : ''}
            </p>
          ) : (
            <p className="hint">停一下就会重算。列名要和题目里写的一致。</p>
          )}
        </section>
        <section className="result-panel">
          <div className="panel-bar">
            <h3>结果</h3>
            <p>{showing ? `${showing.table.rows.length} 行` : '还没有结果'}</p>
          </div>
          {showing ? <ResultTable table={showing.table} /> : <p className="muted">写出一句能运行的 SELECT。</p>}
        </section>
      </div>

      {showing ? <PipelineView pipeline={showing.pipeline} /> : null}

      <section className="challenges">
        <h3>三道小题</h3>
        <ol>
          {lesson.challenges.map((challenge, index) => {
            const passed = (store.progress.passed[lesson.id] ?? []).includes(challenge.id)
            const current = live.get(challenge.id)
            const status = current?.ok ? '当前对上了' : passed ? '已通过' : '还没对上'
            return (
              <li key={challenge.id} className={passed ? 'passed' : ''}>
                <div>
                  <span>0{index + 1}</span>
                  <p>{challenge.prompt}</p>
                </div>
                <p className="status">{status}</p>
                {edited && current && !current.ok ? <p className="reason">{current.reason}</p> : null}
              </li>
            )
          })}
        </ol>
      </section>

      <section className="databook">
        <button type="button" onClick={() => setShowTables((open) => !open)} aria-expanded={showTables}>
          {showTables ? '收起四张表' : '查看四张表'}
          <span>
            {tables.map((table) => `${table.label} ${table.rows.length}`).join(' · ')}
          </span>
        </button>
        {showTables ? (
          <div className="book-grid">
            {tables.map((table) => (
              <TableCard key={table.name} name={table.name} label={table.label} rows={table.rows} />
            ))}
          </div>
        ) : null}
      </section>
    </article>
  )
}

function runView(engine: Engine, statement: string): {
  good: { sql: string; table: Table; pipeline: PipelineModel } | null
  error: string | null
} {
  try {
    const table = engine.query(statement)
    const pipeline = buildPipeline(statement, (next) => engine.query(next))
    return { good: { sql: statement, table, pipeline }, error: null }
  } catch (caught) {
    return { good: null, error: caught instanceof Error ? caught.message : String(caught) }
  }
}

function ResultTable({ table }: { table: Table }) {
  const rows = table.rows.slice(0, 80)
  if (table.columns.length === 0) return <p className="muted">这句没有返回表格。</p>
  return (
    <div className="result-scroll">
      <table>
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((value, cell) => (
                <td key={`${table.columns[cell]}-${cell}`} className={value === null ? 'null-cell' : ''}>
                  {formatValue(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length > rows.length ? <p className="muted">只显示前 {rows.length} 行</p> : null}
    </div>
  )
}

function TableCard({
  name,
  label,
  rows,
}: {
  name: string
  label: string
  rows: readonly object[]
}) {
  const columns = Object.keys(rows[0] ?? {})
  return (
    <section>
      <header>
        <h3>{label}</h3>
        <code>{name}</code>
      </header>
      <div className="result-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>
                  {column}
                  <small>{COLUMN_LABELS[column] ?? ''}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => {
                  const value = (row as Record<string, string | number | null>)[column]
                  return (
                    <td key={column} className={value === null ? 'null-cell' : ''}>
                      {value === null ? '空' : String(value)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
