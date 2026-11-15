export type Customer = {
  customer_id: number
  name: string
  city: string | null
}

export type Book = {
  book_id: number
  title: string
  author: string
  price: number
}

export type Order = {
  order_id: number
  customer_id: number
  ordered_on: string
}

export type OrderItem = {
  item_id: number
  order_id: number
  book_id: number
  quantity: number
}

export const customers: Customer[] = [
  { customer_id: 1, name: '林夏', city: '杭州' },
  { customer_id: 2, name: '周宁', city: '杭州' },
  { customer_id: 3, name: '陈一鸣', city: '成都' },
  { customer_id: 4, name: '苏晚', city: '成都' },
  { customer_id: 5, name: '赵小北', city: '上海' },
  { customer_id: 6, name: '何清', city: '上海' },
  { customer_id: 7, name: '马丽', city: '北京' },
  { customer_id: 8, name: '顾南', city: null },
  { customer_id: 9, name: '许安', city: '南京' },
  { customer_id: 10, name: '丁舟', city: '武汉' },
]

export const books: Book[] = [
  { book_id: 1, title: '海边的信', author: '迟卉', price: 42 },
  { book_id: 2, title: '夜航', author: '迟卉', price: 56 },
  { book_id: 3, title: '木工笔记', author: '梁石', price: 38 },
  { book_id: 4, title: '城市散步', author: '梁石', price: 45 },
  { book_id: 5, title: '烘焙基础', author: '宋糖', price: 68 },
  { book_id: 6, title: '发酵', author: '宋糖', price: 52 },
  { book_id: 7, title: '北方植物', author: '叶芒', price: 88 },
  { book_id: 8, title: '小行星', author: '叶芒', price: 36 },
  { book_id: 9, title: '寂静的车站', author: '顾明', price: 49 },
]

export const orders: Order[] = [
  { order_id: 101, customer_id: 1, ordered_on: '2024-03-02' },
  { order_id: 102, customer_id: 1, ordered_on: '2024-06-18' },
  { order_id: 103, customer_id: 2, ordered_on: '2024-03-21' },
  { order_id: 104, customer_id: 3, ordered_on: '2024-04-09' },
  { order_id: 105, customer_id: 4, ordered_on: '2024-05-01' },
  { order_id: 106, customer_id: 5, ordered_on: '2024-05-14' },
  { order_id: 107, customer_id: 6, ordered_on: '2024-07-02' },
  { order_id: 108, customer_id: 7, ordered_on: '2024-07-19' },
  { order_id: 109, customer_id: 8, ordered_on: '2024-08-08' },
  { order_id: 110, customer_id: 2, ordered_on: '2024-09-12' },
]

export const orderItems: OrderItem[] = [
  { item_id: 1, order_id: 101, book_id: 1, quantity: 1 },
  { item_id: 2, order_id: 101, book_id: 3, quantity: 2 },
  { item_id: 3, order_id: 102, book_id: 5, quantity: 1 },
  { item_id: 4, order_id: 103, book_id: 2, quantity: 1 },
  { item_id: 5, order_id: 103, book_id: 8, quantity: 1 },
  { item_id: 6, order_id: 104, book_id: 7, quantity: 1 },
  { item_id: 7, order_id: 104, book_id: 4, quantity: 1 },
  { item_id: 8, order_id: 105, book_id: 4, quantity: 2 },
  { item_id: 9, order_id: 105, book_id: 6, quantity: 1 },
  { item_id: 10, order_id: 106, book_id: 1, quantity: 1 },
  { item_id: 11, order_id: 107, book_id: 5, quantity: 1 },
  { item_id: 12, order_id: 107, book_id: 6, quantity: 2 },
  { item_id: 13, order_id: 108, book_id: 8, quantity: 3 },
  { item_id: 14, order_id: 109, book_id: 2, quantity: 1 },
  { item_id: 15, order_id: 110, book_id: 3, quantity: 1 },
]

export const tables = [
  { name: 'customers', label: '顾客', rows: customers },
  { name: 'books', label: '图书', rows: books },
  { name: 'orders', label: '订单', rows: orders },
  { name: 'order_items', label: '订单明细', rows: orderItems },
] as const

function lit(value: string | number | null): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') return String(value)
  return `'${value.replaceAll("'", "''")}'`
}

function insert<T extends object>(table: string, rows: T[]): string {
  return rows
    .map((row) => {
      const keys = Object.keys(row) as (keyof T)[]
      const cols = keys.join(', ')
      const vals = keys.map((key) => lit(row[key] as string | number | null)).join(', ')
      return `INSERT INTO ${table} (${cols}) VALUES (${vals});`
    })
    .join('\n')
}

export const SEED_SQL = `
CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY,
  name TEXT,
  city TEXT
);
CREATE TABLE books (
  book_id INTEGER PRIMARY KEY,
  title TEXT,
  author TEXT,
  price INTEGER
);
CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  customer_id INTEGER,
  ordered_on TEXT
);
CREATE TABLE order_items (
  item_id INTEGER PRIMARY KEY,
  order_id INTEGER,
  book_id INTEGER,
  quantity INTEGER
);
${insert('customers', customers)}
${insert('books', books)}
${insert('orders', orders)}
${insert('order_items', orderItems)}
`
