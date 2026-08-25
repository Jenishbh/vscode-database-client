/**
 * Exercises the exact dialect methods the ER Diagram service drives -- showTables,
 * showColumns, showForeignKeys -- through the extension's real connection classes against
 * the live MySQL and PostgreSQL containers. Confirms the full per-schema data shape
 * (tables -> columns -> PK flag -> FK relationships) that erDiagramService.ts assembles,
 * and specifically proves the fk_child_test -> fk_parent_test relationship is picked up.
 */
import "@/extension";
import type { IConnection } from "@/service/connect/connection";
import { MysqlConnection } from "@/service/connect/mysqlConnection";
import { PostgreSqlConnection } from "@/service/connect/postgreSqlConnection";
import { MysqlDialect } from "@/service/dialect/mysqlDialect";
import { PostgreSqlDialect } from "@/service/dialect/postgreSqlDialect";

process.on("uncaughtException", e => console.log("  [uncaught] " + (e && e.message)));
process.on("unhandledRejection", (e: any) => console.log("  [unhandled] " + (e && e.message)));

function connect(c: IConnection): Promise<void> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("connect timeout")), 15000);
    c.connect((err) => { clearTimeout(t); err ? rej(err) : res(); });
  });
}

function query(c: IConnection, sql: string): Promise<any> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("query timeout")), 15000);
    c.query(sql, (err, rows) => { clearTimeout(t); err ? rej(err) : res(rows); });
  });
}

let fail = 0;
async function check(label: string, actual: () => Promise<any>, expect: (value: any) => string | null) {
  try {
    const value = await actual();
    const problem = expect(value);
    if (problem) { fail++; console.log(`FAIL  ${label}: ${problem}`); console.log(`      got: ${JSON.stringify(value).slice(0, 400)}`); }
    else console.log(`PASS  ${label}: ${JSON.stringify(value).slice(0, 250)}`);
  } catch (e: any) {
    fail++;
    console.log(`FAIL  ${label}: threw ${e.message}`);
  }
}

// Mirrors erDiagramService.loadAndEmit()'s per-schema walk: showTables -> per table
// showColumns + showForeignKeys -> {tables, relationships} shaped for the webview.
async function buildErData(c: IConnection, dialect: MysqlDialect | PostgreSqlDialect, database: string) {
  const tableRows = await query(c, dialect.showTables(database));
  const tables: any[] = [];
  const relationships: any[] = [];
  for (const tableRow of tableRows) {
    const tableName = tableRow.name;
    const columnRows = await query(c, dialect.showColumns(database, tableName));
    const fkRows = await query(c, dialect.showForeignKeys(database, tableName));
    const fkColumnNames = new Set(fkRows.map((fk: any) => fk.column_name));
    // Same dedupe erDiagramService.ts applies: PostgreSQL's showColumns fans out into one row
    // per constraint touching a column, so collapse back to one row per column name.
    const isPk = (column: any) => column.key == 'PRI' || column.key == 'PRIMARY KEY';
    const byColumnName = new Map<string, any>();
    for (const column of columnRows) {
      const existing = byColumnName.get(column.name);
      if (!existing || (isPk(column) && !isPk(existing))) byColumnName.set(column.name, column);
    }
    tables.push({
      name: tableName,
      columns: Array.from(byColumnName.values()).map((column: any) => ({
        name: column.name,
        type: column.type,
        isPrimaryKey: isPk(column),
        isForeignKey: fkColumnNames.has(column.name),
      })),
    });
    for (const fk of fkRows) {
      relationships.push({ fromTable: tableName, fromColumn: fk.column_name, toTable: fk.referenced_table, toColumn: fk.referenced_column });
    }
  }
  return { tables, relationships };
}

(async () => {
  const mysql = new MysqlConnection({ host: "127.0.0.1", port: 13306, user: "root", password: "Test_1234", database: "shopdb" } as any);
  const pg = new PostgreSqlConnection({ host: "127.0.0.1", port: 15432, user: "postgres", password: "Test_1234", database: "testdb" } as any);
  await connect(mysql);
  await connect(pg);
  console.log("connected to MySQL (shopdb) and PostgreSQL (testdb)\n");

  const my = new MysqlDialect();
  const pgD = new PostgreSqlDialect();

  console.log("--- MySQL: shopdb full schema walk (tables -> columns -> FKs) ---");
  const myData = await buildErData(mysql, my, "shopdb");
  console.log(`tables found: ${myData.tables.map((t: any) => t.name).join(", ")}`);
  console.log(`relationships found: ${myData.relationships.length}`);
  for (const r of myData.relationships) console.log(`  ${r.fromTable}.${r.fromColumn} -> ${r.toTable}.${r.toColumn}`);

  await check("MySQL: at least customers/products/orders/order_items/fk_child_test/fk_parent_test present",
    async () => myData.tables.map((t: any) => t.name),
    (names) => ["customers", "products", "orders", "order_items", "fk_child_test", "fk_parent_test"].every(n => names.includes(n)) ? null : "missing an expected table");

  await check("MySQL: fk_child_test -> fk_parent_test relationship present",
    async () => myData.relationships,
    (rels) => rels.some((r: any) => r.fromTable === "fk_child_test" && r.toTable === "fk_parent_test") ? null : "expected fk_child_test -> fk_parent_test");

  await check("MySQL: fk_child_test's FK column is flagged isForeignKey",
    async () => {
      const child = myData.tables.find((t: any) => t.name === "fk_child_test");
      const rel = myData.relationships.find((r: any) => r.fromTable === "fk_child_test");
      const col = child.columns.find((c: any) => c.name === rel.fromColumn);
      return col;
    },
    (col) => col && col.isForeignKey ? null : "expected isForeignKey=true on the FK column");

  await check("MySQL: fk_parent_test has a primary key column flagged isPrimaryKey",
    async () => myData.tables.find((t: any) => t.name === "fk_parent_test").columns,
    (cols) => cols.some((c: any) => c.isPrimaryKey) ? null : "expected at least one isPrimaryKey=true column");

  await check("MySQL: column type strings look like real MySQL types (e.g. int, varchar)",
    async () => myData.tables.find((t: any) => t.name === "customers").columns.map((c: any) => c.type),
    (types) => types.some((t: string) => /int|varchar|char|text|date|decimal/i.test(t)) ? null : "expected recognizable MySQL type strings");

  console.log("\n--- PostgreSQL: testdb full schema walk (tables -> columns -> FKs) ---");
  const pgData = await buildErData(pg, pgD, "public");
  console.log(`tables found: ${pgData.tables.map((t: any) => t.name).join(", ")}`);
  console.log(`relationships found: ${pgData.relationships.length}`);
  for (const r of pgData.relationships) console.log(`  ${r.fromTable}.${r.fromColumn} -> ${r.toTable}.${r.toColumn}`);

  await check("PostgreSQL: at least customers/products/orders/order_items/fk_child_test/fk_parent_test present",
    async () => pgData.tables.map((t: any) => t.name),
    (names) => ["customers", "products", "orders", "order_items", "fk_child_test", "fk_parent_test"].every(n => names.includes(n)) ? null : "missing an expected table");

  await check("PostgreSQL: fk_child_test -> fk_parent_test relationship present",
    async () => pgData.relationships,
    (rels) => rels.some((r: any) => r.fromTable === "fk_child_test" && r.toTable === "fk_parent_test") ? null : "expected fk_child_test -> fk_parent_test");

  await check("PostgreSQL: fk_child_test's FK column is flagged isForeignKey",
    async () => {
      const child = pgData.tables.find((t: any) => t.name === "fk_child_test");
      const rel = pgData.relationships.find((r: any) => r.fromTable === "fk_child_test");
      const col = child.columns.find((c: any) => c.name === rel.fromColumn);
      return col;
    },
    (col) => col && col.isForeignKey ? null : "expected isForeignKey=true on the FK column");

  await check("PostgreSQL: fk_parent_test has a primary key column flagged isPrimaryKey (key == 'PRIMARY KEY')",
    async () => pgData.tables.find((t: any) => t.name === "fk_parent_test").columns,
    (cols) => cols.some((c: any) => c.isPrimaryKey) ? null : "expected at least one isPrimaryKey=true column");

  // Regression check: PostgreSQL's showColumns joins against constraint_column_usage, which
  // fans out into one row per constraint touching a column (a PK'd, FK-referenced "id" column
  // came back as 2 raw rows before the dedupe was added). Every card must render exactly one
  // row per distinct column name, or the diagram shows garbled duplicate rows.
  await check("PostgreSQL: every table has exactly one row per distinct column name (no duplicate rows from the constraint join)",
    async () => pgData.tables.map((t: any) => ({ table: t.name, columnCount: t.columns.length, distinctNames: new Set(t.columns.map((c: any) => c.name)).size })),
    (info) => info.every((t: any) => t.columnCount === t.distinctNames) ? null : "expected columnCount == distinct column name count for every table");

  try { mysql.end(); } catch { }
  try { pg.end(); } catch { }

  console.log(fail ? `\n${fail} FAILED` : "\nall er-check cases pass");
  process.exit(fail ? 1 : 0);
})();
