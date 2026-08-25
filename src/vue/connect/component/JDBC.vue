<template>
  <div>
    <section class="mb-2">
      <div class="inline-block mr-10">
        <label class="inline-block w-32 mr-5 font-bold">
          JDBC URL
          <span class="mr-1 text-red-600">*</span>
        </label>
        <input
          class="field__input"
          style="width: 32rem"
          placeholder="jdbc:oracle:thin:@//host:1521/service"
          title="The full JDBC connection url for your database."
          v-model="connectionOption.jdbcUrl"
        />
      </div>
    </section>

    <section class="mb-2">
      <div class="inline-block mr-10">
        <label class="inline-block w-32 mr-5 font-bold">
          Driver Class
          <span class="mr-1 text-red-600">*</span>
        </label>
        <input
          class="field__input"
          style="width: 32rem"
          placeholder="oracle.jdbc.OracleDriver"
          title="Fully qualified driver class name found inside the driver jar."
          v-model="connectionOption.jdbcDriver"
          list="jdbc-driver-presets"
        />
        <datalist id="jdbc-driver-presets">
          <option v-for="p in presets" :key="p.driver" :value="p.driver">{{ p.label }}</option>
        </datalist>
      </div>
    </section>

    <section class="mb-2">
      <span class="text-sm">
        Requires Java on PATH. Drivers for PostgreSQL, MySQL, SQL Server and ClickHouse
        ship with the extension; for anything else drop the jar in the folder set by
        <code>database-client-jenishbh.binaryPath</code>. Nothing is downloaded at runtime &mdash; run
        <b>Database Client: Check External Tools</b> to see what was found.
      </span>
    </section>

    <section class="mb-2">
      <label class="inline-block w-32 mr-5 font-bold">Presets</label>
      <el-select v-model="preset" placeholder="Pick a database" @change="applyPreset">
        <el-option v-for="p in presets" :key="p.driver" :label="p.label" :value="p.driver"></el-option>
      </el-select>
    </section>
  </div>
</template>

<script>
export default {
  props: ["connectionOption"],
  data() {
    return {
      preset: "",
      // url templates use obvious placeholders the user replaces
      presets: [
        { label: "Oracle", driver: "oracle.jdbc.OracleDriver", url: "jdbc:oracle:thin:@//HOST:1521/SERVICE" },
        { label: "IBM Db2", driver: "com.ibm.db2.jcc.DB2Driver", url: "jdbc:db2://HOST:50000/DATABASE" },
        { label: "ClickHouse", driver: "com.clickhouse.jdbc.ClickHouseDriver", url: "jdbc:ch://HOST:8123/default?compress=0" },
        { label: "Snowflake", driver: "net.snowflake.client.jdbc.SnowflakeDriver", url: "jdbc:snowflake://ACCOUNT.snowflakecomputing.com/?db=DATABASE" },
        { label: "Amazon Redshift", driver: "com.amazon.redshift.jdbc.Driver", url: "jdbc:redshift://HOST:5439/DATABASE" },
        { label: "Apache Hive", driver: "org.apache.hive.jdbc.HiveDriver", url: "jdbc:hive2://HOST:10000/default" },
        { label: "Trino", driver: "io.trino.jdbc.TrinoDriver", url: "jdbc:trino://HOST:8080/catalog/schema" },
        { label: "Presto", driver: "com.facebook.presto.jdbc.PrestoDriver", url: "jdbc:presto://HOST:8080/catalog/schema" },
        { label: "Apache Cassandra", driver: "com.ing.data.cassandra.jdbc.CassandraDriver", url: "jdbc:cassandra://HOST:9042/keyspace" },
        { label: "Apache Doris", driver: "com.mysql.cj.jdbc.Driver", url: "jdbc:mysql://HOST:9030/DATABASE" },
        { label: "CockroachDB", driver: "org.postgresql.Driver", url: "jdbc:postgresql://HOST:26257/DATABASE" },
        { label: "H2", driver: "org.h2.Driver", url: "jdbc:h2:/path/to/database" },
        { label: "Apache Derby", driver: "org.apache.derby.jdbc.EmbeddedDriver", url: "jdbc:derby:/path/to/database" },
        { label: "Teradata", driver: "com.teradata.jdbc.TeraDriver", url: "jdbc:teradata://HOST/DATABASE" },
        { label: "SAP HANA", driver: "com.sap.db.jdbc.Driver", url: "jdbc:sap://HOST:39015" },
        { label: "Informix", driver: "com.informix.jdbc.IfxDriver", url: "jdbc:informix-sqli://HOST:9088/DATABASE:INFORMIXSERVER=server" },
        { label: "Firebird", driver: "org.firebirdsql.jdbc.FBDriver", url: "jdbc:firebirdsql://HOST:3050/database" },
        { label: "MySQL", driver: "com.mysql.cj.jdbc.Driver", url: "jdbc:mysql://HOST:3306/DATABASE" },
        { label: "PostgreSQL", driver: "org.postgresql.Driver", url: "jdbc:postgresql://HOST:5432/DATABASE" },
        { label: "SQL Server", driver: "com.microsoft.sqlserver.jdbc.SQLServerDriver", url: "jdbc:sqlserver://HOST:1433;databaseName=DATABASE;encrypt=false" },
      ],
    };
  },
  methods: {
    applyPreset(driver) {
      const p = this.presets.find((x) => x.driver === driver);
      if (!p) return;
      this.connectionOption.jdbcDriver = p.driver;
      if (!this.connectionOption.jdbcUrl) {
        this.connectionOption.jdbcUrl = p.url;
      }
    },
  },
};
</script>
