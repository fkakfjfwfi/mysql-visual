export type Challenge = {
  id: string
  prompt: string
  expectedSql: string
  orderMatters: boolean
}

export type Lesson = {
  id: string
  index: number
  title: string
  explanation: string
  starterSql: string
  challenges: Challenge[]
}

function challenge(id: string, prompt: string, expectedSql: string, orderMatters = false): Challenge {
  return { id, prompt, expectedSql, orderMatters }
}

export const lessons: Lesson[] = [
  {
    id: 'columns',
    index: 1,
    title: '选出指定列',
    explanation:
      '表里有很多列。SELECT 后面点名的列才会出现在结果里，没点名的列还在表中，只是这一次不拿出来。',
    starterSql: 'SELECT name, city\nFROM customers;',
    challenges: [
      challenge('columns-1', '只看图书的书名和单价。结果两列，列名是 title、price。', 'SELECT title, price FROM books;'),
      challenge('columns-2', '只看订单号和下单日期。列名是 order_id、ordered_on。', 'SELECT order_id, ordered_on FROM orders;'),
      challenge('columns-3', '只看顾客编号和姓名。列名是 customer_id、name。', 'SELECT customer_id, name FROM customers;'),
    ],
  },
  {
    id: 'order',
    index: 2,
    title: '排序',
    explanation:
      'ORDER BY 在挑完行之后才排列。列名后面什么都不加是升序，加上 DESC 是降序。汉字按编码排，不是按拼音。这一课的三道题会核对先后。',
    starterSql: 'SELECT name, city\nFROM customers\nORDER BY name;',
    challenges: [
      challenge('order-1', '图书按单价从低到高。列名 title、price，行的顺序要一致。', 'SELECT title, price FROM books ORDER BY price;', true),
      challenge('order-2', '图书按单价从高到低。列名 title、price，行的顺序要一致。', 'SELECT title, price FROM books ORDER BY price DESC;', true),
      challenge(
        'order-3',
        '顾客先按城市，同一城市再按姓名。列名 name、city，行的顺序要一致。',
        'SELECT name, city FROM customers ORDER BY city, name;',
        true,
      ),
    ],
  },
  {
    id: 'where',
    index: 3,
    title: '按条件留行',
    explanation: 'WHERE 决定哪一行留得下来。比较用 =、>、<、>=、<=。城市和书名两边要加单引号。',
    starterSql: "SELECT name, city\nFROM customers\nWHERE city = '杭州';",
    challenges: [
      challenge('where-1', '单价高于 50 的书。列名 title、price。', 'SELECT title, price FROM books WHERE price > 50;'),
      challenge('where-2', '住在成都的顾客，只要姓名。列名 name。', "SELECT name FROM customers WHERE city = '成都';"),
      challenge(
        'where-3',
        '数量不少于 2 的明细。列名 item_id、quantity。',
        'SELECT item_id, quantity FROM order_items WHERE quantity >= 2;',
      ),
    ],
  },
  {
    id: 'null',
    index: 4,
    title: '找出空值',
    explanation:
      '顾南没有填写城市，那一格是空，不是空字符串。空要用 IS NULL 来找。写成 = NULL 找不到：空和谁都不相等，包括另一个空。',
    starterSql: 'SELECT name, city\nFROM customers\nWHERE city IS NULL;',
    challenges: [
      challenge('null-1', '找出没填城市的顾客，只要姓名。列名 name。', 'SELECT name FROM customers WHERE city IS NULL;'),
      challenge(
        'null-2',
        '找出填了城市的顾客，列出姓名和城市。列名 name、city。',
        'SELECT name, city FROM customers WHERE city IS NOT NULL;',
      ),
      challenge(
        'null-3',
        '列出没填城市的顾客编号和姓名。列名 customer_id、name。',
        'SELECT customer_id, name FROM customers WHERE city IS NULL;',
      ),
    ],
  },
  {
    id: 'logic',
    index: 5,
    title: '多个条件',
    explanation: 'AND 要两边都成立，OR 有一边成立即可。条件一多，就用括号标出先算的那一段。',
    starterSql: "SELECT name, city\nFROM customers\nWHERE city = '杭州' OR city = '成都';",
    challenges: [
      challenge(
        'logic-1',
        '杭州的顾客，以及没填城市的顾客。列名 name、city。',
        "SELECT name, city FROM customers WHERE city = '杭州' OR city IS NULL;",
      ),
      challenge(
        'logic-2',
        '迟卉写的，并且单价低于 50 的书。列名 title、price。',
        "SELECT title, price FROM books WHERE author = '迟卉' AND price < 50;",
      ),
      challenge(
        'logic-3',
        '住在上海或北京的顾客，只要姓名。列名 name。',
        "SELECT name FROM customers WHERE city = '上海' OR city = '北京';",
      ),
    ],
  },
  {
    id: 'range',
    index: 6,
    title: '范围和名单',
    explanation: 'BETWEEN 40 AND 60 含两端。IN 后面是一份名单，命中其中任何一个即可。',
    starterSql: 'SELECT title, price\nFROM books\nWHERE price BETWEEN 40 AND 60;',
    challenges: [
      challenge(
        'range-1',
        '单价在 36 和 45 之间（含两端）的书。列名 title、price。',
        'SELECT title, price FROM books WHERE price BETWEEN 36 AND 45;',
      ),
      challenge(
        'range-2',
        '作者是迟卉或叶芒的书。列名 title、author。',
        "SELECT title, author FROM books WHERE author IN ('迟卉', '叶芒');",
      ),
      challenge(
        'range-3',
        '下单日期在 2024-05-01 和 2024-07-31 之间的订单。列名 order_id、ordered_on。',
        "SELECT order_id, ordered_on FROM orders WHERE ordered_on BETWEEN '2024-05-01' AND '2024-07-31';",
      ),
    ],
  },
  {
    id: 'like',
    index: 7,
    title: '模糊匹配',
    explanation: 'LIKE 用来做不完整的匹配。% 代表任意长度的一段字，也可以是空的。林% 是姓林，%植物% 是中间有「植物」。',
    starterSql: "SELECT title\nFROM books\nWHERE title LIKE '%笔记%';",
    challenges: [
      challenge('like-1', '书名里含有「植物」。列名 title。', "SELECT title FROM books WHERE title LIKE '%植物%';"),
      challenge('like-2', '姓林的顾客。列名 name。', "SELECT name FROM customers WHERE name LIKE '林%';"),
      challenge('like-3', '书名以「夜」开头。列名 title。', "SELECT title FROM books WHERE title LIKE '夜%';"),
    ],
  },
  {
    id: 'calc',
    index: 8,
    title: '计算列',
    explanation:
      '结果里可以有表上原本没有的列。price * 0.9 AS sale_price 现算九折，并把这一列命名为 sale_price。单价乘数量也是同一件事，只是乘数来自另一张表。',
    starterSql: 'SELECT title, price, price * 0.9 AS sale_price\nFROM books;',
    challenges: [
      challenge(
        'calc-1',
        '每本书打九折后的价格。列名 title、sale_price，sale_price 写成 price * 0.9。',
        'SELECT title, price * 0.9 AS sale_price FROM books;',
      ),
      challenge(
        'calc-2',
        '每本书的两倍价格。列名 title、double_price，用 price * 2。',
        'SELECT title, price * 2 AS double_price FROM books;',
      ),
      challenge(
        'calc-3',
        '每条明细的书名和金额。列名 title、line_total，line_total 等于单价乘数量。',
        'SELECT books.title, books.price * order_items.quantity AS line_total FROM order_items JOIN books ON books.book_id = order_items.book_id;',
      ),
    ],
  },
  {
    id: 'agg',
    index: 9,
    title: '汇总',
    explanation: 'COUNT、SUM、AVG 把很多行收成一个数。COUNT(*) 数的是行数。这一课的结果通常只有一行。',
    starterSql: 'SELECT COUNT(*) AS customer_count\nFROM customers;',
    challenges: [
      challenge('agg-1', '书店一共有多少本书。一列，列名 book_count。', 'SELECT COUNT(*) AS book_count FROM books;'),
      challenge('agg-2', '所有书的平均单价。一列，列名 avg_price。', 'SELECT AVG(price) AS avg_price FROM books;'),
      challenge(
        'agg-3',
        '明细里的册数合计。一列，列名 total_quantity。',
        'SELECT SUM(quantity) AS total_quantity FROM order_items;',
      ),
    ],
  },
  {
    id: 'group',
    index: 10,
    title: '分组',
    explanation: 'GROUP BY 先把行分成摞，再对每一摞各算一次。每个城市一摞，就得到每个城市的顾客人数。没填城市的人单独成摞。',
    starterSql: 'SELECT city, COUNT(*) AS customer_count\nFROM customers\nGROUP BY city;',
    challenges: [
      challenge(
        'group-1',
        '每位作者有几本书。列名 author、book_count。',
        'SELECT author, COUNT(*) AS book_count FROM books GROUP BY author;',
      ),
      challenge(
        'group-2',
        '每张订单有几条明细。列名 order_id、item_count。',
        'SELECT order_id, COUNT(*) AS item_count FROM order_items GROUP BY order_id;',
      ),
      challenge(
        'group-3',
        '每本书被买走的册数。列名 book_id、sold，sold 是数量之和。',
        'SELECT book_id, SUM(quantity) AS sold FROM order_items GROUP BY book_id;',
      ),
    ],
  },
  {
    id: 'having',
    index: 11,
    title: '分组后再过滤',
    explanation: 'WHERE 在分组前筛行。HAVING 在分组后筛摞。要留下「人数不少于 2」的城市，把条件写在 HAVING 里。',
    starterSql: 'SELECT city, COUNT(*) AS customer_count\nFROM customers\nGROUP BY city\nHAVING COUNT(*) >= 2;',
    challenges: [
      challenge(
        'having-1',
        '至少写了两本书的作者。列名 author、book_count。',
        'SELECT author, COUNT(*) AS book_count FROM books GROUP BY author HAVING COUNT(*) >= 2;',
      ),
      challenge(
        'having-2',
        '明细不少于两条的订单。列名 order_id、item_count。',
        'SELECT order_id, COUNT(*) AS item_count FROM order_items GROUP BY order_id HAVING COUNT(*) >= 2;',
      ),
      challenge(
        'having-3',
        '顾客人数多于 1 人的城市。列名 city、customer_count。',
        'SELECT city, COUNT(*) AS customer_count FROM customers GROUP BY city HAVING COUNT(*) > 1;',
      ),
    ],
  },
  {
    id: 'subquery',
    index: 12,
    title: '子查询',
    explanation: '括号里的 SELECT 先跑完，得到的值再交给外层。可以拿来比大小，也可以用 IN 看某个值在不在那一组结果里。',
    starterSql: 'SELECT title, price\nFROM books\nWHERE price > (SELECT AVG(price) FROM books);',
    challenges: [
      challenge(
        'sub-1',
        '单价高于全部图书平均价的书。列名 title、price。',
        'SELECT title, price FROM books WHERE price > (SELECT AVG(price) FROM books);',
      ),
      challenge(
        'sub-2',
        '下过订单的顾客姓名。列名 name。',
        'SELECT name FROM customers WHERE customer_id IN (SELECT customer_id FROM orders);',
      ),
      challenge(
        'sub-3',
        '从来没被买过的书名。列名 title。',
        'SELECT title FROM books WHERE book_id NOT IN (SELECT book_id FROM order_items);',
      ),
    ],
  },
  {
    id: 'join',
    index: 13,
    title: '两表内联结',
    explanation:
      '订单上只有顾客编号。JOIN ... ON 把编号对得上的顾客接到同一行。对不上的顾客不会出现。写成 JOIN 或 INNER JOIN 都可以。',
    starterSql:
      'SELECT orders.order_id, customers.name\nFROM orders\nJOIN customers ON orders.customer_id = customers.customer_id;',
    challenges: [
      challenge(
        'join-1',
        '每张订单的订单号，以及顾客所在城市。列名 order_id、city。',
        'SELECT orders.order_id, customers.city FROM orders JOIN customers ON orders.customer_id = customers.customer_id;',
      ),
      challenge(
        'join-2',
        '每条明细的书名和数量。列名 title、quantity。',
        'SELECT books.title, order_items.quantity FROM order_items JOIN books ON books.book_id = order_items.book_id;',
      ),
      challenge(
        'join-3',
        '下过单的顾客姓名，以及对应的下单日期。列名 name、ordered_on。',
        'SELECT customers.name, orders.ordered_on FROM orders JOIN customers ON orders.customer_id = customers.customer_id;',
      ),
    ],
  },
  {
    id: 'join3',
    index: 14,
    title: '三表联结',
    explanation: '一个联结的结果还可以继续联结。从顾客到订单，再从订单到明细，一行里就能同时看见是谁、哪张单、买了几本。',
    starterSql: `SELECT customers.name, orders.order_id, order_items.quantity
FROM customers
JOIN orders ON customers.customer_id = orders.customer_id
JOIN order_items ON orders.order_id = order_items.order_id;`,
    challenges: [
      challenge(
        'join3-1',
        '顾客姓名、订单号，以及该明细的数量。列名 name、order_id、quantity。',
        `SELECT customers.name, orders.order_id, order_items.quantity
FROM customers
JOIN orders ON customers.customer_id = orders.customer_id
JOIN order_items ON orders.order_id = order_items.order_id;`,
      ),
      challenge(
        'join3-2',
        '书名、购买数量和下单日期。列名 title、quantity、ordered_on。',
        `SELECT books.title, order_items.quantity, orders.ordered_on
FROM orders
JOIN order_items ON orders.order_id = order_items.order_id
JOIN books ON books.book_id = order_items.book_id;`,
      ),
      challenge(
        'join3-3',
        '数量不少于 2 的明细，列出顾客姓名、订单号和数量。列名 name、order_id、quantity。',
        `SELECT customers.name, orders.order_id, order_items.quantity
FROM customers
JOIN orders ON customers.customer_id = orders.customer_id
JOIN order_items ON orders.order_id = order_items.order_id
WHERE order_items.quantity >= 2;`,
      ),
    ],
  },
  {
    id: 'left',
    index: 15,
    title: '左联结',
    explanation:
      'LEFT JOIN 会留下左边的每一行。右边对不上时，右边的列是空。许安和丁舟没有订单，也会留在结果里。MySQL 里写成 LEFT JOIN 或 LEFT OUTER JOIN 都可以。',
    starterSql: `SELECT customers.name, orders.order_id
FROM customers
LEFT JOIN orders ON customers.customer_id = orders.customer_id;`,
    challenges: [
      challenge(
        'left-1',
        '每一位顾客的姓名和订单号，没下过单的也要留下。列名 name、order_id。',
        `SELECT customers.name, orders.order_id
FROM customers
LEFT JOIN orders ON customers.customer_id = orders.customer_id;`,
      ),
      challenge(
        'left-2',
        '每一本书的书名和明细号，没卖出的书也要留下。列名 title、item_id。',
        `SELECT books.title, order_items.item_id
FROM books
LEFT JOIN order_items ON books.book_id = order_items.book_id;`,
      ),
      challenge(
        'left-3',
        '只留下从来没下过单的顾客姓名。列名 name。',
        `SELECT customers.name
FROM customers
LEFT JOIN orders ON customers.customer_id = orders.customer_id
WHERE orders.order_id IS NULL;`,
      ),
    ],
  },
]

export function lessonById(id: string): Lesson {
  return lessons.find((lesson) => lesson.id === id) ?? lessons[0]
}
