import { CreateIndexParam } from "./param/createIndexParam";
import { SqlDialect } from "./sqlDialect";
import { UpdateTableParam } from "./param/updateTableParam";

/**
 * Dialect for generic JDBC connections.
 *
 * A JDBC target can be any engine, so there is no single SQL that lists its
 * schemas or columns. Browsing therefore goes through JDBC's own
 * DatabaseMetaData: those methods emit a marker that JdbcConnection intercepts
 * and answers from the bridge instead of sending to the server.
 *
 * Statements the user actually sees (paging, counting) must be real SQL for the
 * target, and row limiting is one of the least portable parts of SQL, so the
 * flavour is chosen from the jdbc url scheme.
 */
export const JDBC_META = "--jdbc-meta--";

/** Build a metadata marker, e.g. --jdbc-meta-- tables schemaName */
function meta(op: string, ...args: string[]): string {
    return [JDBC_META, op, ...args.map(a => a === undefined || a === null ? "" : a)].join("\t");
}

/** How a given engine limits rows. */
enum LimitStyle {
    /** LIMIT n - MySQL, PostgreSQL, ClickHouse, Trino, H2, DuckDB, Cockroach... */
    Limit,
    /** FETCH FIRST n ROWS ONLY - Oracle, Db2 */
    FetchFirst,
    /** SELECT TOP n - SQL Server */
    Top,
}

export class JdbcDialect extends SqlDialect {

    private readonly limitStyle: LimitStyle;
    /** Trino rejects a trailing semicolon. */
    private readonly terminator: string;

    constructor(private readonly jdbcUrl?: string) {
        super();
        const url = (jdbcUrl || "").toLowerCase();
        if (/^jdbc:(oracle|db2|as400|informix)/.test(url)) {
            this.limitStyle = LimitStyle.FetchFirst;
        } else if (/^jdbc:(sqlserver|jtds)/.test(url)) {
            this.limitStyle = LimitStyle.Top;
        } else {
            this.limitStyle = LimitStyle.Limit;
        }
        this.terminator = /^jdbc:(trino|presto)/.test(url) ? "" : ";";
    }

    /** schema.table when we know the schema, otherwise the bare name. */
    private qualify(schema: string, table: string): string {
        return schema ? `${schema}.${table}` : table;
    }

    // ---- browsing: answered from DatabaseMetaData ----
    showDatabases(): string { return meta("catalogs"); }
    showSchemas(): string { return meta("schemas"); }
    showTables(database: string): string { return meta("tables", database); }
    showViews(database: string): string { return meta("views", database); }
    showColumns(database: string, table: string): string { return meta("columns", database, table); }
    showIndex(database: string, table: string): string { return meta("indexes", database, table); }

    createIndex(createIndexParam: CreateIndexParam): string {
        // CREATE INDEX ... ON t (c) is the one form shared by effectively every
        // JDBC target that has indexes at all. A PRIMARY KEY is not an index
        // operation, and the syntax for adding one is not portable, so it is
        // left to the engine-specific dialects.
        const type = createIndexParam.type;
        if (type && type != "INDEX" && type != "UNIQUE") { return null; }
        const unique = type == "UNIQUE" ? "UNIQUE " : "";
        const name = `${createIndexParam.column}_${new Date().getTime()}_index`;
        return `CREATE ${unique}INDEX ${name} ON ${createIndexParam.table} (${createIndexParam.column})${this.terminator}`;
    }

    dropIndex(table: string, indexName: string): string {
        const url = (this.jdbcUrl || "").toLowerCase();
        // The three incompatible spellings of the same statement.
        if (/^jdbc:(mysql|mariadb)/.test(url)) {
            return `DROP INDEX ${indexName} ON ${table}${this.terminator}`;
        }
        if (/^jdbc:(sqlserver|jtds)/.test(url)) {
            return `DROP INDEX ${table}.${indexName}${this.terminator}`;
        }
        return `DROP INDEX ${indexName}${this.terminator}`;
    }

    // ---- statements the user sees ----
    buildPageSql(database: string, table: string, pageSize: number): string {
        const target = this.qualify(database, table);
        switch (this.limitStyle) {
            case LimitStyle.FetchFirst:
                return `SELECT * FROM ${target} FETCH FIRST ${pageSize} ROWS ONLY${this.terminator}`;
            case LimitStyle.Top:
                return `SELECT TOP ${pageSize} * FROM ${target}${this.terminator}`;
            default:
                return `SELECT * FROM ${target} LIMIT ${pageSize}${this.terminator}`;
        }
    }

    countSql(database: string, table: string): string {
        return `SELECT COUNT(*) AS count FROM ${this.qualify(database, table)}${this.terminator}`;
    }

    // ---- not portable across JDBC targets ----
    // Returning null makes the caller skip the node rather than send bad SQL.
    showUsers(): string { return null; }
    createUser(): string { return null; }
    showTriggers(database: string): string { return null; }
    showProcedures(database: string): string { return null; }
    showFunctions(database: string): string { return null; }
    showTableSource(database: string, table: string): string { return null; }
    showViewSource(database: string, table: string): string { return null; }
    showProcedureSource(database: string, name: string): string { return null; }
    showFunctionSource(database: string, name: string): string { return null; }
    showTriggerSource(database: string, name: string): string { return null; }
    processList(): string { return null; }
    variableList(): string { return null; }
    statusList(): string { return null; }
    truncateDatabase(database: string): string { return null; }

    createDatabase(database: string): string {
        return `CREATE SCHEMA ${database}${this.terminator}`;
    }

    addColumn(table: string): string {
        return `ALTER TABLE ${table} ADD COLUMN [column] [type]${this.terminator}`;
    }

    updateColumn(table: string, column: string, type: string, comment: string, nullable: string): string {
        const nullClause = nullable === "YES" ? "NULL" : "NOT NULL";
        return `ALTER TABLE ${table} ALTER COLUMN ${column} ${type} ${nullClause}${this.terminator}`;
    }

    updateTable(update: UpdateTableParam): string {
        const { table, newTableName } = update;
        if (newTableName && newTableName !== table) {
            return `ALTER TABLE ${table} RENAME TO ${newTableName}${this.terminator}`;
        }
        return null;
    }

    tableTemplate(): string {
        return `CREATE TABLE [name](
    id int NOT NULL,
    created_at timestamp,
    PRIMARY KEY (id)
);`;
    }
    viewTemplate(): string { return `CREATE VIEW [name] AS\nSELECT * FROM [table];`; }
    procedureTemplate(): string { return null; }
    triggerTemplate(): string { return null; }
    functionTemplate(): string { return null; }
}
