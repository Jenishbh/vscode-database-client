/**
 * End-to-end connectivity tests against real database containers.
 * Drives the extension's own connection classes - the same objects
 * ConnectionManager.create() builds when the UI opens a connection.
 */
// load the real entry first so the module graph initialises in the same order
// production does - the extension has circular imports between Node and the models
import "@/extension";
import type { Node } from "@/model/interface/node";
import type { IConnection } from "@/service/connect/connection";
import { MysqlConnection } from "@/service/connect/mysqlConnection";
import { PostgreSqlConnection } from "@/service/connect/postgreSqlConnection";
import { MSSqlConnnection } from "@/service/connect/mssqlConnection";
import { MongoConnection } from "@/service/connect/mongoConnection";
import { RedisConnection } from "@/service/connect/redisConnection";
import { EsConnection } from "@/service/connect/esConnection";
import { SqliteConnection } from "@/service/connect/sqliteConnection";

type Case = {
  name: string;
  dbType: string;
  auth: string;
  node: any;
  probe: string;
  make: (n: Node) => IConnection;
  expectFail?: boolean;
};

// a driver that throws asynchronously must not abort the whole suite
process.on("uncaughtException", e => console.log("  [uncaught] " + (e && e.message)));
process.on("unhandledRejection", (e: any) => console.log("  [unhandled] " + (e && e.message)));

const results: { name: string, dbType: string, auth: string, ok: boolean, detail: string }[] = [];

function connect(c: IConnection): Promise<void> {
  return new Promise((res, rej) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; rej(new Error("connect timeout 20s")); } }, 20000);
    try {
      c.connect((err) => {
        if (done) return; done = true; clearTimeout(t);
        err ? rej(err) : res();
      });
    } catch (e) { if (!done) { done = true; clearTimeout(t); rej(e); } }
  });
}

function query(c: IConnection, sql: string): Promise<any> {
  return new Promise((res, rej) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; rej(new Error("query timeout 20s")); } }, 20000);
    try {
      c.query(sql, (err, rows) => {
        if (done) return; done = true; clearTimeout(t);
        err ? rej(err) : res(rows);
      });
    } catch (e) { if (!done) { done = true; clearTimeout(t); rej(e); } }
  });
}

function summarise(rows: any): string {
  if (rows == null) return "no rows";
  if (Array.isArray(rows)) return `${rows.length} row(s): ${JSON.stringify(rows[0] ?? {}).slice(0, 90)}`;
  return JSON.stringify(rows).slice(0, 90);
}

async function run(c: Case) {
  let conn: IConnection;
  try {
    conn = c.make(c.node as Node);
    await connect(conn);
    const rows = await query(conn, c.probe);
    const ok = !c.expectFail;
    results.push({ name: c.name, dbType: c.dbType, auth: c.auth, ok, detail: ok ? summarise(rows) : "expected failure but succeeded" });
  } catch (e: any) {
    const msg = (e && e.message ? e.message : String(e)).split("\n")[0].slice(0, 120);
    const ok = !!c.expectFail;
    results.push({ name: c.name, dbType: c.dbType, auth: c.auth, ok, detail: ok ? `correctly rejected: ${msg}` : msg });
  } finally {
    try { conn && conn.end(); } catch { }
  }
}

const MY = (o: any) => ({ host: "127.0.0.1", user: "root", password: "Test_1234", connectTimeout: 8000, ...o });

const cases: Case[] = [
  { name: "MySQL 8.0 - user/password", dbType: "MySQL", auth: "native password",
    node: MY({ port: 13306, database: "testdb" }), probe: "select version() v, database() db",
    make: n => new MysqlConnection(n) },

  { name: "MySQL 8.0 - wrong password (negative)", dbType: "MySQL", auth: "native password",
    node: MY({ port: 13306, password: "WRONG", database: "testdb" }), probe: "select 1",
    make: n => new MysqlConnection(n), expectFail: true },

  { name: "MariaDB 11 - user/password", dbType: "MySQL", auth: "native password",
    node: MY({ port: 13307, database: "testdb" }), probe: "select version() v, database() db",
    make: n => new MysqlConnection(n) },

  { name: "PostgreSQL 16 - user/password", dbType: "PostgreSQL", auth: "scram-sha-256",
    node: MY({ port: 15432, user: "postgres", database: "testdb" }), probe: "select version() as v, current_database() as db",
    make: n => new PostgreSqlConnection(n) },

  { name: "PostgreSQL 16 - wrong password (negative)", dbType: "PostgreSQL", auth: "scram-sha-256",
    node: MY({ port: 15432, user: "postgres", password: "WRONG", database: "testdb" }), probe: "select 1",
    make: n => new PostgreSqlConnection(n), expectFail: true },

  { name: "SQL Server 2022 - SQL auth (authType=default)", dbType: "SqlServer", auth: "default / SQL login",
    node: MY({ port: 11433, user: "sa", password: "Test_1234!", database: "master", authType: "default", encrypt: false }),
    probe: "select @@version as v, db_name() as db", make: n => new MSSqlConnnection(n) },

  { name: "SQL Server 2022 - SQL auth + encrypt=true", dbType: "SqlServer", auth: "default + TLS",
    node: MY({ port: 11433, user: "sa", password: "Test_1234!", database: "master", authType: "default", encrypt: true }),
    probe: "select @@version as v", make: n => new MSSqlConnnection(n) },

  { name: "SQL Server 2022 - wrong password (negative)", dbType: "SqlServer", auth: "default / SQL login",
    node: MY({ port: 11433, user: "sa", password: "WRONG_1234!", database: "master", authType: "default", encrypt: false }),
    probe: "select 1", make: n => new MSSqlConnnection(n), expectFail: true },

  { name: "SQL Server - ntlm/Windows Auth (against Linux container)", dbType: "SqlServer", auth: "ntlm + domain",
    node: MY({ port: 11433, user: "sa", password: "Test_1234!", database: "master", authType: "ntlm", domain: "WORKGROUP", encrypt: false }),
    probe: "select 1", make: n => new MSSqlConnnection(n), expectFail: true },

  { name: "MongoDB 7 - user/password", dbType: "MongoDB", auth: "SCRAM",
    node: MY({ port: 27018, database: "admin" }), probe: "show dbs",
    make: n => new MongoConnection(n) },

  { name: "Redis 7 - password (requirepass)", dbType: "Redis", auth: "password",
    node: MY({ port: 16379, user: undefined }), probe: "info server",
    make: n => new RedisConnection(n) },

  { name: "Redis 7 - no auth", dbType: "Redis", auth: "none",
    node: MY({ port: 16380, password: undefined, user: undefined }), probe: "info server",
    make: n => new RedisConnection(n) },

  { name: "ElasticSearch 8.12 - no auth (http)", dbType: "ElasticSearch", auth: "none",
    node: MY({ host: "127.0.0.1:19200", scheme: "http", user: undefined, password: undefined }), probe: "get /",
    make: n => new EsConnection(n) },

  { name: "SQLite - local file (no auth)", dbType: "SQLite", auth: "none",
    node: { dbPath: process.env.SQLITE_DB, dbType: "SQLite" }, probe: "select sqlite_version() as v",
    make: n => new SqliteConnection(n) },
];

// the sqlite connection resolves its bundled binary through Global.context
require("@/common/global").Global.context = { extensionPath: process.env.EXT_PATH };

(async () => {
  for (const c of cases) {
    process.stdout.write(`running: ${c.name} ... `);
    await run(c);
    const r = results[results.length - 1];
    console.log(r.ok ? "PASS" : "FAIL");
  }

  console.log("\n================ RESULTS ================");
  const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
  console.log(pad("DB", 14) + pad("AUTH", 22) + pad("RESULT", 8) + "DETAIL");
  console.log("-".repeat(110));
  for (const r of results) {
    console.log(pad(r.dbType, 14) + pad(r.auth, 22) + pad(r.ok ? "PASS" : "FAIL", 8) + r.detail);
  }
  const passed = results.filter(r => r.ok).length;
  console.log("-".repeat(110));
  console.log(`${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})();
