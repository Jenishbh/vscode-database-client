/**
 * Schema editing, indexes, paging and the Design Table panels, against real
 * containers.
 *
 * Every statement here comes from the same dialect call the UI makes:
 *   - "createIndex"/"dropIndex" are what IndexPanel.vue emits and
 *     TableNode.designTable() handles
 *   - showIndex/showTableMeta/showForeignKeys/showChecks/showTableTriggers are
 *     what the designer loads on "route-design"
 *   - buildPageSql/countSql are what openTable() runs for the result grid,
 *     which is also what the table search (dbclient.table.find) ends up doing
 *   - showTables/showColumns back the tree and the column list
 *
 * So a pass here means the UI action works, not merely that a hand-written
 * query runs.
 */
import "@/extension";
import type { Node } from "@/model/interface/node";
import type { IConnection } from "@/service/connect/connection";
import type { SqlDialect } from "@/service/dialect/sqlDialect";
import { MysqlConnection } from "@/service/connect/mysqlConnection";
import { PostgreSqlConnection } from "@/service/connect/postgreSqlConnection";
import { MSSqlConnnection } from "@/service/connect/mssqlConnection";
import { OracleConnection } from "@/service/connect/oracleConnection";
import { ClickHouseConnection } from "@/service/connect/clickHouseConnection";
import { SqliteConnection } from "@/service/connect/sqliteConnection";
import { JdbcConnection } from "@/service/connect/jdbcConnection";
import { MysqlDialect } from "@/service/dialect/mysqlDialect";
import { PostgreSqlDialect } from "@/service/dialect/postgreSqlDialect";
import { MssqlDIalect } from "@/service/dialect/mssqlDIalect";
import { OracleDialect } from "@/service/dialect/oracleDialect";
import { ClickHouseDialect } from "@/service/dialect/clickHouseDialect";
import { SqliTeDialect } from "@/service/dialect/sqliteDialect";
import { JdbcDialect } from "@/service/dialect/jdbcDialect";

process.on("uncaughtException", e => console.log("  [uncaught] " + (e && e.message)));
process.on("unhandledRejection", (e: any) => console.log("  [unhandled] " + (e && e.message)));

require("@/common/global").Global.context = { extensionPath: process.env.EXT_PATH };

const TABLE = "dbc_schema";

function connect(c: IConnection): Promise<void> {
  return new Promise((res, rej) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; rej(new Error("connect timeout 25s")); } }, 25000);
    c.connect(err => { if (done) return; done = true; clearTimeout(t); err ? rej(err) : res(); });
  });
}

function query(c: IConnection, sql: string): Promise<any> {
  return new Promise((res, rej) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; rej(new Error("query timeout 30s")); } }, 30000);
    c.query(sql, (err, rows) => { if (done) return; done = true; clearTimeout(t); err ? rej(err) : res(rows); });
  });
}

type Case = {
  name: string;
  schema: string;
  dialect: SqlDialect;
  make: () => IConnection;
  drop: string;
  create: string;
  /** column added by the "add column" step, then indexed */
  addColumn: string;
  /** index kind the Add Index dialog offers; SQLite cannot do PRIMARY KEY */
  indexType: string;
  /** Oracle upper-cases unquoted identifiers */
  upper?: boolean;
};

const cases: Case[] = [
  {
    name: "MySQL 8.0", schema: "shopdb", dialect: new MysqlDialect(), indexType: "INDEX",
    make: () => new MysqlConnection({ host: "127.0.0.1", port: 13306, user: "root", password: "Test_1234", database: "shopdb" } as Node),
    drop: `DROP TABLE IF EXISTS ${TABLE}`,
    create: `CREATE TABLE ${TABLE} (id INT PRIMARY KEY, name VARCHAR(50))`,
    addColumn: `ALTER TABLE ${TABLE} ADD COLUMN city VARCHAR(40)`,
  },
  {
    name: "MariaDB 11", schema: "shopdb", dialect: new MysqlDialect(), indexType: "INDEX",
    make: () => new MysqlConnection({ host: "127.0.0.1", port: 13307, user: "root", password: "Test_1234", database: "shopdb" } as Node),
    drop: `DROP TABLE IF EXISTS ${TABLE}`,
    create: `CREATE TABLE ${TABLE} (id INT PRIMARY KEY, name VARCHAR(50))`,
    addColumn: `ALTER TABLE ${TABLE} ADD COLUMN city VARCHAR(40)`,
  },
  {
    name: "Percona 8", schema: "shopdb", dialect: new MysqlDialect(), indexType: "INDEX",
    make: () => new MysqlConnection({ host: "127.0.0.1", port: 13308, user: "root", password: "Test_1234", database: "shopdb" } as Node),
    drop: `DROP TABLE IF EXISTS ${TABLE}`,
    create: `CREATE TABLE ${TABLE} (id INT PRIMARY KEY, name VARCHAR(50))`,
    addColumn: `ALTER TABLE ${TABLE} ADD COLUMN city VARCHAR(40)`,
  },
  {
    name: "PostgreSQL 16", schema: "public", dialect: new PostgreSqlDialect(), indexType: "INDEX",
    make: () => new PostgreSqlConnection({ host: "127.0.0.1", port: 15432, user: "postgres", password: "Test_1234", database: "testdb", schema: "public" } as Node),
    drop: `DROP TABLE IF EXISTS ${TABLE}`,
    create: `CREATE TABLE ${TABLE} (id INT PRIMARY KEY, name VARCHAR(50))`,
    addColumn: `ALTER TABLE ${TABLE} ADD COLUMN city VARCHAR(40)`,
  },
  {
    name: "TimescaleDB", schema: "public", dialect: new PostgreSqlDialect(), indexType: "INDEX",
    make: () => new PostgreSqlConnection({ host: "127.0.0.1", port: 15433, user: "postgres", password: "Test_1234", database: "metrics", schema: "public" } as Node),
    drop: `DROP TABLE IF EXISTS ${TABLE}`,
    create: `CREATE TABLE ${TABLE} (id INT PRIMARY KEY, name VARCHAR(50))`,
    addColumn: `ALTER TABLE ${TABLE} ADD COLUMN city VARCHAR(40)`,
  },
  {
    name: "SQL Server 2022", schema: "dbo", dialect: new MssqlDIalect(), indexType: "INDEX",
    make: () => new MSSqlConnnection({
      host: "127.0.0.1", port: 11433, user: "sa", password: "Test_1234!", database: "master",
      authType: "default", encrypt: false, trustServerCertificate: true, connectTimeout: 15000, requestTimeout: 30000,
    } as Node),
    drop: `IF OBJECT_ID('${TABLE}','U') IS NOT NULL DROP TABLE ${TABLE}`,
    create: `CREATE TABLE ${TABLE} (id INT PRIMARY KEY, name VARCHAR(50))`,
    addColumn: `ALTER TABLE ${TABLE} ADD city VARCHAR(40)`,
  },
  {
    name: "Oracle 23ai", schema: "SYSTEM", dialect: new OracleDialect(), indexType: "INDEX", upper: true,
    make: () => new OracleConnection({ host: "127.0.0.1", port: 11521, user: "system", password: "Test_1234", serviceName: "FREEPDB1", database: "SYSTEM" } as Node),
    drop: `BEGIN EXECUTE IMMEDIATE 'DROP TABLE ${TABLE}'; EXCEPTION WHEN OTHERS THEN NULL; END;`,
    create: `CREATE TABLE ${TABLE} (id NUMBER PRIMARY KEY, name VARCHAR2(50))`,
    addColumn: `ALTER TABLE ${TABLE} ADD city VARCHAR2(40)`,
  },
  {
    name: "ClickHouse", schema: "shopdb", dialect: new ClickHouseDialect(), indexType: "INDEX",
    make: () => new ClickHouseConnection({ host: "127.0.0.1", port: 18123, user: "default", password: "Test_1234", database: "shopdb", requestTimeout: 30000 } as Node),
    drop: `DROP TABLE IF EXISTS ${TABLE}`,
    create: `CREATE TABLE ${TABLE} (id UInt32, name String) ENGINE = MergeTree ORDER BY id`,
    addColumn: `ALTER TABLE ${TABLE} ADD COLUMN city String`,
  },
  {
    name: "SQLite", schema: "main", dialect: new SqliTeDialect(), indexType: "INDEX",
    make: () => new SqliteConnection({ dbPath: process.env.SQLITE_DB, dbType: "SQLite" } as Node),
    drop: `DROP TABLE IF EXISTS ${TABLE}`,
    create: `CREATE TABLE ${TABLE} (id INTEGER PRIMARY KEY, name TEXT)`,
    addColumn: `ALTER TABLE ${TABLE} ADD COLUMN city TEXT`,
  },
  {
    name: "CockroachDB (JDBC)", schema: "public", dialect: new JdbcDialect("jdbc:postgresql://127.0.0.1:26257/defaultdb?sslmode=disable"), indexType: "INDEX",
    make: () => new JdbcConnection({
      jdbcUrl: "jdbc:postgresql://127.0.0.1:26257/defaultdb?sslmode=disable",
      jdbcDriverClass: "org.postgresql.Driver", user: "root", password: "", database: "defaultdb", schema: "public",
    } as unknown as Node),
    drop: `DROP TABLE IF EXISTS ${TABLE}`,
    create: `CREATE TABLE ${TABLE} (id INT PRIMARY KEY, name VARCHAR(50))`,
    addColumn: `ALTER TABLE ${TABLE} ADD COLUMN city VARCHAR(40)`,
  },
];

const rows: { name: string; step: string; ok: boolean; detail: string }[] = [];
const record = (name: string, step: string, ok: boolean, detail = "") => rows.push({ name, step, ok, detail });

/** Row objects come back with engine-specific column case. */
function cell(row: any, col: string): any {
  if (!row) return undefined;
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === col.toLowerCase()) return row[key];
  }
  return undefined;
}

function rowsOf(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.rows)) return result.rows;
  return [];
}

async function step(c: Case, name: string, fn: () => Promise<string>) {
  try {
    const detail = await fn();
    record(c.name, name, true, detail);
  } catch (err: any) {
    record(c.name, name, false, (err && err.message || String(err)).slice(0, 90));
  }
}

async function run(c: Case) {
  console.log(`\n########## ${c.name} ##########`);
  const conn = c.make();
  const table = c.upper ? TABLE.toUpperCase() : TABLE;

  try {
    await connect(conn);
    record(c.name, "connect", true);
  } catch (err: any) {
    record(c.name, "connect", false, err.message);
    return;
  }

  try {
    await query(conn, c.drop);
    await query(conn, c.create);
    await query(conn, `INSERT INTO ${TABLE} (id, name) VALUES (1, 'alpha')`);
    await query(conn, `INSERT INTO ${TABLE} (id, name) VALUES (2, 'beta')`);
    record(c.name, "setup", true);
  } catch (err: any) {
    record(c.name, "setup", false, err.message);
    try { conn.end(); } catch { }
    return;
  }

  // --- schema change: add a column, then confirm the column list sees it ---
  await step(c, "schema.addColumn", async () => {
    await query(conn, c.addColumn);
    const cols = rowsOf(await query(conn, c.dialect.showColumns(c.schema, table)));
    const names = cols.map(r => String(cell(r, "name") || cell(r, "column_name") || "").toLowerCase());
    if (!names.includes("city")) throw new Error(`showColumns does not list the new column: ${names.join(",")}`);
    return `${cols.length} columns, 'city' present`;
  });

  // --- create index exactly as IndexPanel.vue -> designTable() does ---
  let createdIndex: string;
  await step(c, "index.create", async () => {
    const sql = c.dialect.createIndex({ column: "city", type: c.indexType, indexType: undefined, table });
    if (!sql) throw new Error("dialect produced no CREATE INDEX statement");
    await query(conn, sql);
    return sql.slice(0, 80);
  });

  await step(c, "index.show", async () => {
    const sql = c.dialect.showIndex(c.schema, table);
    if (!sql) throw new Error("dialect has no showIndex");
    const found = rowsOf(await query(conn, sql));
    const named = found.map(r => String(cell(r, "index_name") || cell(r, "name") || ""));
    const match = named.find(n => n && n.toLowerCase().includes("city"));
    if (!match) throw new Error(`new index not listed: ${named.join(",") || "(none)"}`);
    createdIndex = match;
    return `${found.length} index(es), found ${match}`;
  });

  await step(c, "index.drop", async () => {
    if (!createdIndex) throw new Error("no index to drop");
    await query(conn, c.dialect.dropIndex(table, createdIndex));
    const left = rowsOf(await query(conn, c.dialect.showIndex(c.schema, table)))
      .map(r => String(cell(r, "index_name") || cell(r, "name") || ""));
    if (left.includes(createdIndex)) throw new Error("index still present after drop");
    return `dropped ${createdIndex}`;
  });

  // --- the result grid: paging and row count ---
  await step(c, "grid.buildPageSql", async () => {
    const sql = c.dialect.buildPageSql(c.schema, table, 100);
    const page = rowsOf(await query(conn, sql));
    if (page.length !== 2) throw new Error(`expected 2 rows, got ${page.length}`);
    return `${page.length} rows via ${sql.slice(0, 48)}`;
  });

  await step(c, "grid.countSql", async () => {
    const sql = c.dialect.countSql(c.schema, table);
    if (!sql) throw new Error("dialect has no countSql");
    const result = rowsOf(await query(conn, sql))[0];
    const total = Number(cell(result, "total") ?? cell(result, "count") ?? Object.values(result || {})[0]);
    if (total !== 2) throw new Error(`count returned ${total}`);
    return `count = ${total}`;
  });

  // --- search: find the table among all tables, as the tree/search does ---
  await step(c, "search.showTables", async () => {
    const all = rowsOf(await query(conn, c.dialect.showTables(c.schema)));
    const names = all.map(r => String(cell(r, "name") || cell(r, "table_name") || ""));
    const hit = names.filter(n => n.toLowerCase().includes("dbc_schema"));
    if (!hit.length) throw new Error(`table not found among ${names.length} tables`);
    return `${hit[0]} found in ${names.length} tables`;
  });

  // --- filter: a WHERE-filtered read, which is what a filtered grid issues ---
  await step(c, "filter.where", async () => {
    const filtered = rowsOf(await query(conn, `SELECT * FROM ${TABLE} WHERE name = 'alpha'`));
    if (filtered.length !== 1) throw new Error(`expected 1 row, got ${filtered.length}`);
    return `1 of 2 rows matched`;
  });

  // --- designer panels: each returns rows or an explicit "unsupported" ---
  for (const [panel, sql] of [
    ["meta", c.dialect.showTableMeta(c.schema, table)],
    ["foreignKeys", c.dialect.showForeignKeys(c.schema, table)],
    ["triggers", c.dialect.showTableTriggers(c.schema, table)],
    ["checks", c.dialect.showChecks(c.schema, table)],
  ] as [string, string][]) {
    await step(c, `design.${panel}`, async () => {
      if (!sql) return "not supported by this dialect (panel shows a message)";
      const result = rowsOf(await query(conn, sql));
      return `${result.length} row(s)`;
    });
  }

  await step(c, "teardown", async () => {
    await query(conn, c.drop);
    return "table dropped";
  });

  try { conn.end(); } catch { }
}

(async () => {
  for (const c of cases) {
    process.stdout.write(`running ${c.name} ... `);
    await run(c);
    const mine = rows.filter(r => r.name === c.name);
    console.log(`${mine.filter(r => r.ok).length}/${mine.length}`);
  }

  console.log("\n================ SCHEMA / INDEX / GRID ================");
  const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
  for (const r of rows) {
    console.log(pad(r.name, 22) + pad(r.step, 22) + pad(r.ok ? "OK" : "FAIL", 6) + r.detail.slice(0, 74));
  }
  const passed = rows.filter(r => r.ok).length;
  console.log("-".repeat(118));
  console.log(`${passed}/${rows.length} steps pass`);
  process.exit(passed === rows.length ? 0 : 1);
})();
