import type { SqlValue } from './types'

export function formatValue(value: SqlValue): string {
  if (value === null || value === undefined) return '空'
  if (value instanceof Uint8Array) return '(二进制)'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value)
    const rounded = Math.round(value * 10000) / 10000
    return String(rounded)
  }
  return String(value)
}

export function sameValue(left: SqlValue, right: SqlValue): boolean {
  if (left instanceof Uint8Array || right instanceof Uint8Array) {
    return formatValue(left) === formatValue(right)
  }
  if (left === null || right === null) return left === right
  if (typeof left === 'number' && typeof right === 'number') {
    return Math.abs(left - right) < 1e-6
  }
  return String(left) === String(right)
}
