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
import { FTPConnection } from "@/service/connect/ftpConnection";
import { JdbcConnection } from "@/service/connect/jdbcConnection";
import { ClientManager } from "@/service/ssh/clientManager";

type Case = {
  name: string;
  dbType: string;
  auth: string;
  node: any;
  probe: string | null;
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
    const rows = c.probe ? await query(conn, c.probe) : "connected (no query surface)";
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

  { name: "JDBC - PostgreSQL", dbType: "JDBC", auth: "url + driver class",
    node: { jdbcUrl: "jdbc:postgresql://127.0.0.1:15432/testdb", jdbcDriver: "org.postgresql.Driver", user: "postgres", password: "Test_1234" },
    probe: "select count(*) as customers from customers", make: n => new JdbcConnection(n) },

  { name: "JDBC - MySQL", dbType: "JDBC", auth: "url + driver class",
    node: { jdbcUrl: "jdbc:mysql://127.0.0.1:13306/shopdb", jdbcDriver: "com.mysql.cj.jdbc.Driver", user: "root", password: "Test_1234" },
    probe: "select count(*) as customers from customers", make: n => new JdbcConnection(n) },

  { name: "JDBC - SQL Server", dbType: "JDBC", auth: "url + driver class",
    node: { jdbcUrl: "jdbc:sqlserver://127.0.0.1:11433;databaseName=shopdb;encrypt=false;trustServerCertificate=true", jdbcDriver: "com.microsoft.sqlserver.jdbc.SQLServerDriver", user: "sa", password: "Test_1234!" },
    probe: "select count(*) as customers from customers", make: n => new JdbcConnection(n) },

  { name: "JDBC - ClickHouse", dbType: "JDBC", auth: "url + driver class",
    node: { jdbcUrl: "jdbc:ch://127.0.0.1:18123/shopdb?compress=0", jdbcDriver: "com.clickhouse.jdbc.ClickHouseDriver", user: "default", password: "Test_1234" },
    probe: "select count(*) as customers from customers", make: n => new JdbcConnection(n) },

  { name: "JDBC - Oracle 23ai", dbType: "JDBC", auth: "url + driver class",
    node: { jdbcUrl: "jdbc:oracle:thin:@//127.0.0.1:11521/FREEPDB1", jdbcDriver: "oracle.jdbc.OracleDriver", user: "system", password: "Test_1234" },
    probe: "select count(*) as customers from customers", make: n => new JdbcConnection(n) },

  { name: "JDBC - Trino", dbType: "JDBC", auth: "url + driver class",
    node: { jdbcUrl: "jdbc:trino://127.0.0.1:18080/tpch/sf1", jdbcDriver: "io.trino.jdbc.TrinoDriver", user: "test", password: "" },
    probe: "select count(*) as customers from tpch.sf1.nation", make: n => new JdbcConnection(n) },

  { name: "JDBC - bad driver class (negative)", dbType: "JDBC", auth: "url + driver class",
    node: { jdbcUrl: "jdbc:postgresql://127.0.0.1:15432/testdb", jdbcDriver: "no.such.Driver", user: "postgres", password: "Test_1234" },
    probe: "select 1", make: n => new JdbcConnection(n), expectFail: true },

  { name: "FTP - user/password", dbType: "FTP", auth: "user/password",
    node: MY({ port: 12121, user: "testuser", encoding: "utf8" }), probe: null,
    make: n => new FTPConnection(n) },

  { name: "SQLite - local file (no auth)", dbType: "SQLite", auth: "none",
    node: { dbPath: process.env.SQLITE_DB, dbType: "SQLite" }, probe: "select sqlite_version() as v",
    make: n => new SqliteConnection(n) },
];

// the sqlite connection resolves its bundled binary through Global.context
require("@/common/global").Global.context = { extensionPath: process.env.EXT_PATH };

async function sshCase() {
  process.stdout.write("running: SSH - password auth ... ");
  try {
    const ssh: any = await ClientManager.getSSH(
      { host: "127.0.0.1", port: 12222, username: "testuser", password: "Test_1234", type: "password" } as any,
      { withSftp: true });
    const listed: any = await new Promise((res, rej) => {
      ssh.sftp.readdir("/", (err: any, list: any) => err ? rej(err) : res(list));
    });
    results.push({ name: "SSH - password auth", dbType: "SSH", auth: "password", ok: true,
      detail: `sftp listed ${listed.length} entries at /` });
    console.log("PASS");
    try { ssh.client.end(); } catch { }
  } catch (e: any) {
    results.push({ name: "SSH - password auth", dbType: "SSH", auth: "password", ok: false,
      detail: (e && e.message ? e.message : String(e)).slice(0, 110) });
    console.log("FAIL");
  }
}

(async () => {
  for (const c of cases) {
    process.stdout.write(`running: ${c.name} ... `);
    await run(c);
    const r = results[results.length - 1];
    console.log(r.ok ? "PASS" : "FAIL");
  }

  await sshCase();

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
