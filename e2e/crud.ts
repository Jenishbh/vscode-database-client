/**
 * Full CRUD round-trip against real containers, driven through the extension's
 * own connection classes and dialects - the same objects the UI uses when a
 * user opens a connection and edits a table.
 *
 * Verifies more than "did it connect": every step asserts on the data that
 * comes back, so a driver that silently swallows a write still fails here.
 */
import "@/extension";
import type { Node } from "@/model/interface/node";
import type { IConnection } from "@/service/connect/connection";
import { OracleConnection } from "@/service/connect/oracleConnection";
import { MSSqlConnnection } from "@/service/connect/mssqlConnection";
import { OracleDialect } from "@/service/dialect/oracleDialect";
import { MssqlDIalect } from "@/service/dialect/mssqlDIalect";
import type { SqlDialect } from "@/service/dialect/sqlDialect";

process.on("uncaughtException", e => console.log("  [uncaught] " + (e && e.message)));
process.on("unhandledRejection", (e: any) => console.log("  [unhandled] " + (e && e.message)));

function connect(c: IConnection): Promise<void> {
  return new Promise((res, rej) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; rej(new Error("connect timeout 20s")); } }, 20000);
    c.connect(err => { if (done) return; done = true; clearTimeout(t); err ? rej(err) : res(); });
  });
}

function query(c: IConnection, sql: string): Promise<any> {
  return new Promise((res, rej) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; rej(new Error("query timeout 20s")); } }, 20000);
    c.query(sql, (err, rows) => { if (done) return; done = true; clearTimeout(t); err ? rej(err) : res(rows); });
  });
}

type Case = {
  name: string;
  schema: string;
  make: () => IConnection;
  dialect: SqlDialect;
  ddl: { drop: string; create: string };
};

const cases: Case[] = [
  {
    name: "Oracle 23 (native/thin)",
    schema: "SYSTEM",
    dialect: new OracleDialect(),
    make: () => new OracleConnection({
      host: "127.0.0.1", port: 11521, user: "system", password: "Test_1234",
      serviceName: "FREEPDB1", database: "SYSTEM",
    } as Node),
    ddl: {
      drop: `BEGIN EXECUTE IMMEDIATE 'DROP TABLE dbc_crud'; EXCEPTION WHEN OTHERS THEN NULL; END;`,
      create: `CREATE TABLE dbc_crud (id NUMBER PRIMARY KEY, name VARCHAR2(50))`,
    },
  },
  {
    name: "SQL Server 2022 (sql auth)",
    schema: "dbo",
    dialect: new MssqlDIalect(),
    make: () => new MSSqlConnnection({
      host: "127.0.0.1", port: 11433, user: "sa", password: "Test_1234!",
      database: "master", authType: "default", encrypt: false,
      trustServerCertificate: true, connectTimeout: 15000, requestTimeout: 30000,
    } as Node),
    ddl: {
      drop: `IF OBJECT_ID('dbc_crud','U') IS NOT NULL DROP TABLE dbc_crud`,
      create: `CREATE TABLE dbc_crud (id INT PRIMARY KEY, name VARCHAR(50))`,
    },
  },
];

const rows: { name: string; step: string; ok: boolean; detail: string }[] = [];
const record = (name: string, step: string, ok: boolean, detail = "") =>
  rows.push({ name, step, ok, detail });

/** Rows come back as objects; column case varies by engine. */
function cell(row: any, col: string): any {
  if (!row) return undefined;
  const key = Object.keys(row).find(k => k.toLowerCase() === col.toLowerCase());
  return key ? row[key] : undefined;
}

async function run(c: Case) {
  console.log(`\n########## ${c.name} ##########`);
  let conn: IConnection;
  try {
    conn = c.make();
    await connect(conn);
    record(c.name, "connect", true);
    console.log("  connect  OK");
  } catch (e: any) {
    record(c.name, "connect", false, e.message);
    console.log("  connect  FAIL " + e.message);
    return;
  }

  try {
    await query(conn, c.ddl.drop);
    await query(conn, c.ddl.create);
    record(c.name, "create", true);
    console.log("  create   OK");

    await query(conn, `INSERT INTO dbc_crud (id, name) VALUES (1, 'alpha')`);
    await query(conn, `INSERT INTO dbc_crud (id, name) VALUES (2, 'beta')`);
    record(c.name, "insert", true);
    console.log("  insert   OK");

    let r = await query(conn, `SELECT id, name FROM dbc_crud ORDER BY id`);
    const readOk = r.length === 2 && String(cell(r[0], "name")) === "alpha";
    record(c.name, "read", readOk, `${r.length} rows`);
    console.log(`  read     ${readOk ? "OK" : "FAIL"} (${r.length} rows: ${r.map((x: any) => cell(x, "name")).join(", ")})`);

    await query(conn, `UPDATE dbc_crud SET name = 'ALPHA' WHERE id = 1`);
    r = await query(conn, `SELECT name FROM dbc_crud WHERE id = 1`);
    const updOk = String(cell(r[0], "name")) === "ALPHA";
    record(c.name, "update", updOk, String(cell(r[0], "name")));
    console.log(`  update   ${updOk ? "OK" : "FAIL"} (${cell(r[0], "name")})`);

    await query(conn, `DELETE FROM dbc_crud WHERE id = 2`);
    r = await query(conn, `SELECT COUNT(*) AS N FROM dbc_crud`);
    const delOk = Number(cell(r[0], "n")) === 1;
    record(c.name, "delete", delOk, String(cell(r[0], "n")));
    console.log(`  delete   ${delOk ? "OK" : "FAIL"} (${cell(r[0], "n")} remaining)`);

    // the dialect SQL the tree and table designer actually issue
    const tables = await query(conn, c.dialect.showTables(c.schema));
    const found = tables.some((t: any) => String(cell(t, "name")).toLowerCase() === "dbc_crud");
    record(c.name, "dialect.showTables", found, `${tables.length} tables`);
    console.log(`  showTables ${found ? "OK" : "FAIL"} (${tables.length} tables, dbc_crud ${found ? "found" : "MISSING"})`);

    const cols = await query(conn, c.dialect.showColumns(c.schema, "dbc_crud"));
    const colOk = cols.length === 2 && cols.some((x: any) => String(cell(x, "name")).toLowerCase() === "name");
    record(c.name, "dialect.showColumns", colOk, `${cols.length} cols`);
    console.log(`  showColumns ${colOk ? "OK" : "FAIL"} (${cols.map((x: any) => cell(x, "name")).join(", ")})`);

    await query(conn, c.ddl.drop);
    record(c.name, "drop", true);
    console.log("  drop     OK");
  } catch (e: any) {
    record(c.name, "exception", false, e.message);
    console.log("  FAIL " + e.message);
  } finally {
    try { conn.end() } catch { }
  }
}

(async () => {
  for (const c of cases) await run(c);

  console.log("\n================ CRUD ================");
  const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
  for (const r of rows) {
    console.log(pad(r.name, 28) + pad(r.step, 22) + pad(r.ok ? "OK" : "FAIL", 6) + r.detail.slice(0, 60));
  }
  const passed = rows.filter(r => r.ok).length;
  console.log("-".repeat(80));
  console.log(`${passed}/${rows.length} steps pass`);
  process.exit(passed === rows.length ? 0 : 1);
})();
