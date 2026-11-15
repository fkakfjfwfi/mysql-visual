export type SqlValue = string | number | null | Uint8Array

export type Table = {
  columns: string[]
  rows: SqlValue[][]
}

export type Field = {
  name: string
  value: string
}

export type Card = {
  id: string
  fields: Field[]
  state: 'kept' | 'dropped'
  note?: string
  rank?: number
}

export type JoinLink = {
  leftId: string
  rightId: string
  state: 'kept' | 'dropped'
}

export type Stage =
  | {
      kind: 'rows'
      title: string
      detail: string
      cards: Card[]
      hidden: number
    }
  | {
      kind: 'join'
      title: string
      detail: string
      leftTitle: string
      rightTitle: string
      left: Card[]
      right: Card[]
      links: JoinLink[]
      hidden: number
    }
  | {
      kind: 'groups'
      title: string
      detail: string
      piles: {
        id: string
        label: string
        summary: string
        state: 'kept' | 'dropped'
        rank?: number
        cards: Card[]
      }[]
    }

export type PipelineModel = {
  subqueries: {
    sql: string
    values: string[]
    stages: Stage[]
  }[]
  stages: Stage[]
  note?: string
}

export type TableRef = {
  name: string
  alias: string | null
}

export type JoinKind = 'inner' | 'left' | 'cross' | 'right'

export type ParsedJoin = {
  kind: JoinKind
  table: TableRef
  on: string | null
}

export type ParsedSelect = {
  sql: string
  distinct: boolean
  columnsSql: string
  columns: { sql: string; alias: string | null }[]
  fromSql: string
  base: TableRef
  joins: ParsedJoin[]
  where: string | null
  groupBy: string | null
  having: string | null
  orderBy: string | null
  limit: string | null
  subqueries: string[]
}
