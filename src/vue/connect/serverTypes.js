/**
 * Catalogue of server types offered by the connect panel.
 *
 * kind: "native" - the extension has a dedicated driver for it
 *       "jdbc"   - handled by the generic JDBC connector; picking it sets
 *                  dbType to JDBC and prefills the url template and driver class
 *
 * bundled: true when the driver jar ships with the extension, so the type works
 *          with no extra download. Otherwise the user drops the jar into the
 *          folder named by database-client.binaryPath.
 */

export const PRIMARY = [
  { label: "MySQL", icon: "🐬", kind: "native", dbType: "MySQL" },
  { label: "MariaDB", icon: "🌊", kind: "native", dbType: "MySQL", port: 3306 },
  { label: "PostgreSQL", icon: "🐘", kind: "native", dbType: "PostgreSQL" },
  { label: "SQLite", icon: "📘", kind: "native", dbType: "SQLite" },
  { label: "SQL Server", icon: "🗄️", kind: "native", dbType: "SqlServer" },
  {
    label: "Db2", icon: "🔷", kind: "jdbc", bundled: false,
    driver: "com.ibm.db2.jcc.DB2Driver", url: "jdbc:db2://HOST:50000/DATABASE",
  },
  { label: "Oracle", icon: "🔴", kind: "native", dbType: "Oracle", port: 1521 },
  {
    label: "Kingbase", icon: "🗝️", kind: "jdbc", bundled: false,
    driver: "com.kingbase8.Driver", url: "jdbc:kingbase8://HOST:54321/DATABASE",
  },
  { label: "ClickHouse", icon: "📊", kind: "native", dbType: "ClickHouse", port: 8123 },
  { label: "JDBC", icon: "☕", kind: "jdbc", bundled: true, driver: "", url: "" },
];

export const SECONDARY = [
  { label: "SSH", icon: "🔐", kind: "native", dbType: "SSH" },
  { label: "Redis", icon: "🧱", kind: "native", dbType: "Redis" },
  { label: "ElasticSearch", icon: "🔎", kind: "native", dbType: "ElasticSearch" },
  { label: "MongoDB", icon: "🍃", kind: "native", dbType: "MongoDB" },
  { label: "FTP", icon: "📁", kind: "native", dbType: "FTP" },
  { label: "S3", icon: "🪣", kind: "native", dbType: "S3" },
  { label: "Exasol", icon: "⚡", kind: "native", dbType: "Exasol" },
  {
    label: "Cassandra", icon: "👁️", kind: "jdbc", bundled: false,
    driver: "com.ing.data.cassandra.jdbc.CassandraDriver", url: "jdbc:cassandra://HOST:9042/keyspace",
  },
];

export const MORE = [
  {
    label: "DuckDB", icon: "🦆", kind: "jdbc", bundled: false,
    driver: "org.duckdb.DuckDBDriver", url: "jdbc:duckdb:/path/to/file.duckdb",
  },
  {
    label: "Turso", icon: "🐢", kind: "jdbc", bundled: false,
    driver: "tech.turso.jdbc.Driver", url: "jdbc:turso://HOST?authToken=TOKEN",
  },
  {
    label: "Azure SQL Server", icon: "☁️", kind: "jdbc", bundled: true,
    driver: "com.microsoft.sqlserver.jdbc.SQLServerDriver",
    url: "jdbc:sqlserver://SERVER.database.windows.net:1433;databaseName=DATABASE;encrypt=true",
  },
  {
    label: "Hive", icon: "🐝", kind: "jdbc", bundled: false,
    driver: "org.apache.hive.jdbc.HiveDriver", url: "jdbc:hive2://HOST:10000/default",
  },
  {
    label: "Redshift", icon: "🟥", kind: "jdbc", bundled: false,
    driver: "com.amazon.redshift.jdbc.Driver", url: "jdbc:redshift://HOST:5439/DATABASE",
  },
  {
    label: "Cockroach", icon: "🪳", kind: "jdbc", bundled: true,
    driver: "org.postgresql.Driver", url: "jdbc:postgresql://HOST:26257/DATABASE?sslmode=disable",
  },
  {
    label: "Athena", icon: "🏛️", kind: "jdbc", bundled: false,
    driver: "com.simba.athena.jdbc.Driver", url: "jdbc:awsathena://AwsRegion=REGION;S3OutputLocation=s3://BUCKET/",
  },
  {
    label: "Big Query", icon: "🔵", kind: "jdbc", bundled: false,
    driver: "com.simba.googlebigquery.jdbc.Driver", url: "jdbc:bigquery://https://www.googleapis.com/bigquery/v2:443;ProjectId=PROJECT;",
  },
  {
    label: "Snowflake", icon: "❄️", kind: "jdbc", bundled: false,
    driver: "net.snowflake.client.jdbc.SnowflakeDriver", url: "jdbc:snowflake://ACCOUNT.snowflakecomputing.com/?db=DATABASE",
  },
  {
    label: "Databricks", icon: "🧱", kind: "jdbc", bundled: false,
    driver: "com.databricks.client.jdbc.Driver", url: "jdbc:databricks://HOST:443/default;transportMode=http;httpPath=PATH",
  },
  {
    label: "Dameng", icon: "🀄", kind: "jdbc", bundled: false,
    driver: "dm.jdbc.driver.DmDriver", url: "jdbc:dm://HOST:5236/DATABASE",
  },
  {
    label: "GaussDB", icon: "🟠", kind: "jdbc", bundled: false,
    driver: "com.huawei.gaussdb.jdbc.Driver", url: "jdbc:gaussdb://HOST:8000/DATABASE",
  },
  {
    label: "TDengine", icon: "📈", kind: "jdbc", bundled: false,
    driver: "com.taosdata.jdbc.rs.RestfulDriver", url: "jdbc:TAOS-RS://HOST:6041/DATABASE",
  },
  {
    label: "Apache Doris", icon: "🔶", kind: "jdbc", bundled: true,
    driver: "com.mysql.cj.jdbc.Driver", url: "jdbc:mysql://HOST:9030/DATABASE",
  },
  {
    label: "Trino", icon: "🦎", kind: "jdbc", bundled: true,
    driver: "io.trino.jdbc.TrinoDriver", url: "jdbc:trino://HOST:8080/catalog/schema",
  },
  {
    label: "Presto", icon: "🎭", kind: "jdbc", bundled: false,
    driver: "com.facebook.presto.jdbc.PrestoDriver", url: "jdbc:presto://HOST:8080/catalog/schema",
  },
  {
    label: "Neo4j", icon: "🕸️", kind: "jdbc", bundled: false,
    driver: "org.neo4j.jdbc.Neo4jDriver", url: "jdbc:neo4j:bolt://HOST:7687",
  },
  {
    label: "H2", icon: "💧", kind: "jdbc", bundled: true,
    driver: "org.h2.Driver", url: "jdbc:h2:/path/to/database",
  },
  {
    label: "Teradata", icon: "🟧", kind: "jdbc", bundled: false,
    driver: "com.teradata.jdbc.TeraDriver", url: "jdbc:teradata://HOST/DATABASE",
  },
  {
    label: "SAP HANA", icon: "🟦", kind: "jdbc", bundled: false,
    driver: "com.sap.db.jdbc.Driver", url: "jdbc:sap://HOST:39015",
  },
  {
    label: "Firebird", icon: "🔥", kind: "jdbc", bundled: false,
    driver: "org.firebirdsql.jdbc.FBDriver", url: "jdbc:firebirdsql://HOST:3050/database",
  },
  {
    label: "Informix", icon: "🟪", kind: "jdbc", bundled: false,
    driver: "com.informix.jdbc.IfxDriver", url: "jdbc:informix-sqli://HOST:9088/DB:INFORMIXSERVER=server",
  },
];

export const ALL = [...PRIMARY, ...SECONDARY, ...MORE];

/** Apply a catalogue entry to the connection form. */
export function applyServerType(entry, connectionOption) {
  // remembered so the tree can show the right icon for engines that share a driver
  connectionOption.serverType = entry.label;
  if (entry.kind === "native") {
    connectionOption.dbType = entry.dbType;
    connectionOption.jdbcUrl = undefined;
    connectionOption.jdbcDriver = undefined;
    if (entry.port) connectionOption.port = entry.port;
    return;
  }
  connectionOption.dbType = "JDBC";
  connectionOption.jdbcDriver = entry.driver || "";
  connectionOption.jdbcUrl = entry.url || "";
}

/** Which catalogue entry is currently selected, for highlighting. */
export function matchServerType(connectionOption) {
  // an explicit choice wins: MariaDB and MySQL share a driver but are distinct
  if (connectionOption.serverType) {
    const exact = ALL.find(e => e.label === connectionOption.serverType);
    if (exact) return exact;
  }
  if (connectionOption.dbType !== "JDBC") {
    return ALL.find(e => e.kind === "native" && e.dbType === connectionOption.dbType);
  }
  return ALL.find(e => e.kind === "jdbc" && e.driver && e.driver === connectionOption.jdbcDriver)
    || ALL.find(e => e.label === "JDBC");
}
