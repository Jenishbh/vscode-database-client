import { JdbcDialect } from "@/service/dialect/jdbcDialect";

const cases: { url: string, expectPage: string, expectCount: string }[] = [
  { url: "jdbc:mysql://h:3306/shopdb",
    expectPage: "SELECT * FROM shopdb.customers LIMIT 100;",
    expectCount: "SELECT COUNT(*) AS count FROM shopdb.customers;" },
  { url: "jdbc:postgresql://h:5432/testdb",
    expectPage: "SELECT * FROM analytics.daily_sales LIMIT 100;",
    expectCount: "SELECT COUNT(*) AS count FROM analytics.daily_sales;" },
  { url: "jdbc:sqlserver://h:1433;databaseName=shopdb",
    expectPage: "SELECT TOP 100 * FROM dbo.customers;",
    expectCount: "SELECT COUNT(*) AS count FROM dbo.customers;" },
  { url: "jdbc:oracle:thin:@//h:1521/FREEPDB1",
    expectPage: "SELECT * FROM SYSTEM.CUSTOMERS FETCH FIRST 100 ROWS ONLY;",
    expectCount: "SELECT COUNT(*) AS count FROM SYSTEM.CUSTOMERS;" },
  { url: "jdbc:ch://h:8123/shopdb?compress=0",
    expectPage: "SELECT * FROM shopdb.customers LIMIT 100;",
    expectCount: "SELECT COUNT(*) AS count FROM shopdb.customers;" },
  { url: "jdbc:trino://h:8080/tpch/sf1",
    expectPage: "SELECT * FROM information_schema.applicable_roles LIMIT 100",
    expectCount: "SELECT COUNT(*) AS count FROM information_schema.applicable_roles" },
];

const targets: { [url: string]: [string, string] } = {
  "jdbc:mysql://h:3306/shopdb": ["shopdb", "customers"],
  "jdbc:postgresql://h:5432/testdb": ["analytics", "daily_sales"],
  "jdbc:sqlserver://h:1433;databaseName=shopdb": ["dbo", "customers"],
  "jdbc:oracle:thin:@//h:1521/FREEPDB1": ["SYSTEM", "CUSTOMERS"],
  "jdbc:ch://h:8123/shopdb?compress=0": ["shopdb", "customers"],
  "jdbc:trino://h:8080/tpch/sf1": ["information_schema", "applicable_roles"],
};

let fail = 0;
for (const c of cases) {
  const d = new JdbcDialect(c.url);
  const [schema, table] = targets[c.url];
  const page = d.buildPageSql(schema, table, 100);
  const count = d.countSql(schema, table);
  const okP = page === c.expectPage, okC = count === c.expectCount;
  if (!okP || !okC) fail++;
  console.log(`${okP && okC ? "PASS" : "FAIL"}  ${c.url.slice(0, 44)}`);
  if (!okP) console.log(`   page  got: ${page}\n         want: ${c.expectPage}`);
  if (!okC) console.log(`   count got: ${count}\n         want: ${c.expectCount}`);
  if (okP && okC) console.log(`   ${page}`);
}
console.log(fail ? `\n${fail} FAILED` : "\nall dialect cases pass");
process.exit(fail ? 1 : 0);
