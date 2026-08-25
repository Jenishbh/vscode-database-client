/**
 * Exercises the table-designer dialect methods (showTableMeta, showForeignKeys,
 * showTableTriggers, showChecks, showTableSource) through the extension's real
 * connection classes against the live MySQL and PostgreSQL containers - the same
 * code path tableNode.designTable() drives.
 */
import "@/extension";
import type { Node } from "@/model/interface/node";
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
async function check(label: string, sql: string, c: IConnection, expect: (rows: any) => string | null) {
  try {
    const rows = await query(c, sql);
    const problem = expect(rows);
    if (problem) { fail++; console.log(`FAIL  ${label}: ${problem}`); console.log(`      sql: ${sql}`); console.log(`      got: ${JSON.stringify(rows).slice(0, 300)}`); }
    else console.log(`PASS  ${label}: ${JSON.stringify(rows).slice(0, 200)}`);
  } catch (e: any) {
    fail++;
    console.log(`FAIL  ${label}: threw ${e.message}`);
    console.log(`      sql: ${sql}`);
  }
}

(async () => {
  const mysql = new MysqlConnection({ host: "127.0.0.1", port: 13306, user: "root", password: "Test_1234", database: "shopdb" } as any as Node);
  const pg = new PostgreSqlConnection({ host: "127.0.0.1", port: 15432, user: "postgres", password: "Test_1234", database: "testdb" } as any as Node);
  await connect(mysql);
  await connect(pg);
  console.log("connected to MySQL (shopdb) and PostgreSQL (testdb)\n");

  const my = new MysqlDialect();
  const pgD = new PostgreSqlDialect();

  console.log("--- MySQL: fk_child_test (has FK to fk_parent_test, a CHECK, and a trigger) ---");
  await check("showTableMeta", my.showTableMeta("shopdb", "fk_child_test"), mysql,
    rows => (rows[0] && rows[0].engine === "InnoDB" && rows[0].collation) ? null : "expected engine=InnoDB + collation");
  await check("showForeignKeys", my.showForeignKeys("shopdb", "fk_child_test"), mysql,
    rows => (rows.length === 1 && rows[0].referenced_table === "fk_parent_test") ? null : "expected 1 FK to fk_parent_test");
  await check("showTableTriggers", my.showTableTriggers("shopdb", "fk_child_test"), mysql,
    rows => (rows.length === 1 && rows[0].trigger_name === "trg_fk_child_test") ? null : "expected 1 trigger");
  await check("showChecks", my.showChecks("shopdb", "fk_child_test"), mysql,
    rows => (rows.length === 1 && /amount/.test(rows[0].check_clause)) ? null : "expected 1 check on amount");
  await check("showTableSource (DDL)", my.showTableSource("shopdb", "fk_child_test"), mysql,
    rows => (rows[0] && /CREATE TABLE/.test(rows[0]['Create Table'])) ? null : "expected CREATE TABLE text");

  console.log("\n--- MySQL: customers (plain sample table, no FK/trigger/check) ---");
  await check("showForeignKeys (expect empty, not error)", my.showForeignKeys("shopdb", "customers"), mysql,
    rows => Array.isArray(rows) && rows.length === 0 ? null : "expected empty array");
  await check("showTableTriggers (expect empty, not error)", my.showTableTriggers("shopdb", "customers"), mysql,
    rows => Array.isArray(rows) && rows.length === 0 ? null : "expected empty array");
  await check("showChecks (expect empty, not error)", my.showChecks("shopdb", "customers"), mysql,
    rows => Array.isArray(rows) && rows.length === 0 ? null : "expected empty array");

  console.log("\n--- PostgreSQL: fk_child_test (has FK to fk_parent_test, a CHECK, and a trigger) ---");
  await check("showTableMeta", pgD.showTableMeta("public", "fk_child_test"), pg,
    rows => (rows[0] && rows[0].engine === "heap" && rows[0].collation) ? null : "expected engine=heap + collation");
  await check("showForeignKeys", pgD.showForeignKeys("public", "fk_child_test"), pg,
    rows => (rows.length === 1 && rows[0].referenced_table === "fk_parent_test") ? null : "expected 1 FK to fk_parent_test");
  await check("showTableTriggers", pgD.showTableTriggers("public", "fk_child_test"), pg,
    rows => (rows.length === 1 && rows[0].trigger_name === "trg_fk_child_test") ? null : "expected 1 trigger");
  await check("showChecks", pgD.showChecks("public", "fk_child_test"), pg,
    rows => (rows.length === 1 && /amount/.test(rows[0].check_clause)) ? null : "expected 1 check on amount");
  await check("showTableSource (DDL)", pgD.showTableSource("public", "fk_child_test"), pg,
    rows => (rows[0] && /CREATE TABLE/.test(rows[0]['Create Table'])) ? null : "expected CREATE TABLE text");

  console.log("\n--- PostgreSQL: customers (plain sample table, no FK/trigger/check) ---");
  await check("showForeignKeys (expect empty, not error)", pgD.showForeignKeys("public", "customers"), pg,
    rows => Array.isArray(rows) && rows.length === 0 ? null : "expected empty array");
  await check("showTableTriggers (expect empty, not error)", pgD.showTableTriggers("public", "customers"), pg,
    rows => Array.isArray(rows) && rows.length === 0 ? null : "expected empty array");
  await check("showChecks (expect empty, not error)", pgD.showChecks("public", "customers"), pg,
    rows => Array.isArray(rows) && rows.length === 0 ? null : "expected empty array");
  await check("showTableSource on real sample table", pgD.showTableSource("public", "customers"), pg,
    rows => (rows[0] && /CREATE TABLE public\.customers/.test(rows[0]['Create Table'])) ? null : "expected CREATE TABLE public.customers");

  try { mysql.end(); } catch { }
  try { pg.end(); } catch { }

  console.log(fail ? `\n${fail} FAILED` : "\nall design-check cases pass");
  process.exit(fail ? 1 : 0);
})();
