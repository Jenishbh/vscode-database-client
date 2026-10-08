/**
 * What the result grid is handed when a table is opened.
 *
 * The grid gates inline editing, row selection, delete and the insert dialog's
 * fields on result.primaryKey, result.columnList and result.tableCount, all of
 * which QueryPage derives by matching the table name out of the SQL and looking
 * that name up as a node. When the match is wrong the query still succeeds and
 * the grid silently turns read only, so this asserts the metadata, not the rows.
 */
import "@/extension";
import { QueryPage } from "@/service/result/query";

process.on("uncaughtException", e => console.log("  [uncaught] " + (e && e.message)));
process.on("unhandledRejection", (e: any) => console.log("  [unhandled] " + (e && e.message)));

type Case = { sql: string; engine: string; mssql?: boolean; expect: string };

/** The statement each dialect builds for "open table", per e2e/dialect. */
const cases: Case[] = [
  { engine: "SQL Server", mssql: true, sql: "SELECT TOP 100 * FROM dbo.order_items;", expect: "order_items" },
  { engine: "SQL Server no schema", mssql: true, sql: "SELECT TOP 100 * FROM order_items;", expect: "order_items" },
  { engine: "SQL Server bracketed", mssql: true, sql: "SELECT TOP 100 * FROM [dbo].[order_items];", expect: "order_items" },
  { engine: "Oracle", sql: "SELECT * FROM SYSTEM.CUSTOMERS FETCH FIRST 100 ROWS ONLY;", expect: "SYSTEM.CUSTOMERS" },
  { engine: "MySQL", sql: "SELECT * FROM shopdb.customers LIMIT 100;", expect: "shopdb.customers" },
  { engine: "MySQL quoted", sql: "SELECT * FROM `customers` LIMIT 100;", expect: "customers" },
  { engine: "PostgreSQL", sql: "SELECT * FROM analytics.daily_sales LIMIT 100;", expect: "analytics.daily_sales" },
  { engine: "ClickHouse", sql: "SELECT * FROM shopdb.customers LIMIT 100;", expect: "shopdb.customers" },
  { engine: "SQLite", sql: "SELECT * FROM customers LIMIT 100;", expect: "customers" },
  { engine: "trailing where", sql: "select * from customers where id = 1;", expect: "customers" },
  { engine: "no trailing clause", sql: "SELECT * FROM customers;", expect: "customers" },
  { engine: "join", sql: "SELECT * FROM orders o JOIN customers c ON c.id=o.customer_id;", expect: "orders" },
];

const rows: { engine: string; ok: boolean; detail: string }[] = [];

/** The expression loadColumnList() uses to find the table in the statement. */
const TABLE_IN_SQL = /(?<=\b(from|join)\b\s*)(\S+)/gi;

/** Mirrors how loadColumnList() turns that match into a node lookup key. */
function resolve(c: Case): string {
  const matched = c.sql.match(TABLE_IN_SQL);
  if (!matched) { return null; }
  let name = QueryPage.stripTerminator(matched[0]);
  if (c.mssql && name.indexOf(".") != -1) { name = name.split(".")[1]; }
  return QueryPage.unquote(name);
}

for (const c of cases) {
  const got = resolve(c);
  rows.push({
    engine: c.engine,
    ok: got === c.expect,
    detail: got === c.expect
      ? `-> ${JSON.stringify(got)}`
      : `-> ${JSON.stringify(got)} but the node is named ${JSON.stringify(c.expect)}`,
  });
}

// unquote has to handle each style without eating the name
const unquoteCases: [string, string][] = [
  ["`customers`", "customers"],
  ['"customers"', "customers"],
  ["[customers]", "customers"],
  ["customers", "customers"],
];
for (const [input, want] of unquoteCases) {
  const got = QueryPage.unquote(input);
  rows.push({ engine: "unquote " + input, ok: got === want, detail: `-> ${JSON.stringify(got)}` });
}

console.log("================ RESULT GRID METADATA ================");
const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
for (const r of rows) {
  console.log("  " + pad(r.engine, 24) + pad(r.ok ? "OK" : "FAIL", 6) + r.detail);
}
const passed = rows.filter(r => r.ok).length;
console.log("-".repeat(84));
console.log(`${passed}/${rows.length} table names resolve`);
process.exit(passed === rows.length ? 0 : 1);
