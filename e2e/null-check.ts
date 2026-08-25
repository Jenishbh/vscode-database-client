/**
 * Confirms the new designer dialect methods degrade to null (never throw) for
 * dialects that don't implement them, so the designer tabs can show a
 * "not supported" message instead of erroring.
 */
import { MssqlDIalect } from "@/service/dialect/mssqlDIalect";
import { SqliTeDialect } from "@/service/dialect/sqliteDialect";
import { JdbcDialect } from "@/service/dialect/jdbcDialect";

const dialects: [string, any][] = [
  ["MssqlDIalect", new MssqlDIalect()],
  ["SqliTeDialect", new SqliTeDialect()],
  ["JdbcDialect", new JdbcDialect("jdbc:oracle:thin:@//h:1521/x")],
];

let fail = 0;
for (const [name, d] of dialects) {
  for (const method of ["showTableMeta", "showForeignKeys", "showTableTriggers", "showChecks"]) {
    try {
      const result = d[method]("db", "t");
      if (result !== null) { fail++; console.log(`FAIL  ${name}.${method}() = ${JSON.stringify(result)}, expected null`); }
      else console.log(`PASS  ${name}.${method}() = null`);
    } catch (e: any) {
      fail++;
      console.log(`FAIL  ${name}.${method}() threw: ${e.message}`);
    }
  }
}
console.log(fail ? `\n${fail} FAILED` : "\nall null-check cases pass");
process.exit(fail ? 1 : 0);
