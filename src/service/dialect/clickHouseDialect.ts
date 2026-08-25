import { CreateIndexParam } from "./param/createIndexParam";
import { UpdateColumnParam } from "./param/updateColumnParam";
import { UpdateTableParam } from "./param/updateTableParam";
import { SqlDialect } from "./sqlDialect";

/**
 * ClickHouse.
 *
 * Catalog lives in the system database. ClickHouse has no stored procedures,
 * functions or triggers in the SQL sense, so those queries return an empty
 * set rather than null - the tree renders an empty group instead of erroring.
 */
export class ClickHouseDialect extends SqlDialect {

    private empty(column: string): string {
        return `SELECT '' AS ${column} WHERE 1 = 0`;
    }

    showDatabases(): string {
        return `SELECT name AS "Database" FROM system.databases ORDER BY name`;
    }
    showSchemas(): string {
        return `SELECT name AS "Database", name AS "schema" FROM system.databases ORDER BY name`;
    }
    showTables(database: string): string {
        return `SELECT name AS "name", comment AS "comment" FROM system.tables
        WHERE database = '${database}' AND engine NOT IN ('View','MaterializedView') ORDER BY name`;
    }
    showViews(database: string): string {
        return `SELECT name AS "name" FROM system.tables
        WHERE database = '${database}' AND engine IN ('View','MaterializedView') ORDER BY name`;
    }
    showColumns(database: string, table: string): string {
        return `SELECT name AS "name", type AS "simpleType", type AS "type",
        if(type LIKE 'Nullable(%)', 'YES', 'NO') AS nullable,
        character_octet_length AS "maxLength", default_expression AS "defaultValue",
        comment AS "comment", if(is_in_primary_key, 'PRI', '') AS "key"
        FROM system.columns WHERE database = '${database}' AND table = '${table}' ORDER BY position`;
    }
    showUsers(): string {
        return `SELECT name AS "user" FROM system.users ORDER BY name`;
    }
    createUser(): string {
        return `CREATE USER [name] IDENTIFIED WITH sha256_password BY '[password]'`;
    }
    showIndex(database: string, table: string): string {
        return `SELECT name AS index_name, concat(type, ' (', expr, ')') AS indexdef
        FROM system.data_skipping_indices WHERE database = '${database}' AND table = '${table}'`;
    }
    createIndex(createIndexParam: CreateIndexParam): string {
        return `ALTER TABLE ${createIndexParam.table} ADD INDEX ${createIndexParam.column}_index ${createIndexParam.column} TYPE minmax GRANULARITY 1`;
    }
    dropIndex(table: string, indexName: string): string {
        return `ALTER TABLE ${table} DROP INDEX ${indexName}`;
    }
    showTriggers(database: string): string {
        return this.empty("TRIGGER_NAME");
    }
    showProcedures(database: string): string {
        return this.empty("ROUTINE_NAME");
    }
    showFunctions(database: string): string {
        return `SELECT name AS "ROUTINE_NAME" FROM system.functions WHERE origin != 'System' ORDER BY name`;
    }
    showTableSource(database: string, table: string): string {
        return `SHOW CREATE TABLE ${database}.${table}`;
    }
    showViewSource(database: string, table: string): string {
        return `SHOW CREATE TABLE ${database}.${table}`;
    }
    showProcedureSource(database: string, name: string): string {
        return this.empty("Create Procedure");
    }
    showFunctionSource(database: string, name: string): string {
        return `SELECT create_query AS "Create Function" FROM system.functions WHERE name = '${name}'`;
    }
    showTriggerSource(database: string, name: string): string {
        return this.empty("SQL Original Statement");
    }
    showTableMeta(database: string, table: string): string {
        return `SELECT engine AS engine, '' AS collation FROM system.tables
        WHERE database = '${database}' AND name = '${table}'`;
    }
    buildPageSql(database: string, table: string, pageSize: number): string {
        return `SELECT * FROM ${table} LIMIT ${pageSize}`;
    }
    countSql(database: string, table: string): string {
        return `SELECT count() FROM ${table}`;
    }
    createDatabase(database: string): string {
        return `CREATE DATABASE ${database}`;
    }
    truncateDatabase(database: string): string {
        return `SELECT concat('TRUNCATE TABLE ', database, '.', name, ';') AS trun
        FROM system.tables WHERE database = '${database}' AND engine NOT IN ('View','MaterializedView')`;
    }
    addColumn(table: string): string {
        return `ALTER TABLE ${table} ADD COLUMN [column] [type]`;
    }
    updateColumn(table: string, column: string, type: string, comment: string, nullable: string): string {
        return `ALTER TABLE ${table} MODIFY COLUMN ${column} ${type};
ALTER TABLE ${table} RENAME COLUMN ${column} TO [newColumnName];`;
    }
    updateColumnSql(updateColumnParam: UpdateColumnParam): string {
        const { columnName, columnType, newColumnName, comment, table } = updateColumnParam
        let sql = `ALTER TABLE ${table} MODIFY COLUMN ${columnName} ${columnType};`;
        if (comment) {
            sql += `\nALTER TABLE ${table} COMMENT COLUMN ${columnName} '${comment}';`
        }
        if (columnName != newColumnName) {
            sql += `\nALTER TABLE ${table} RENAME COLUMN ${columnName} TO ${newColumnName};`
        }
        return sql;
    }
    updateTable(update: UpdateTableParam): string {
        const { table, newTableName, comment, newComment } = update
        let sql = "";
        if (newComment && newComment != comment) {
            sql = `ALTER TABLE ${table} MODIFY COMMENT '${newComment}';`;
        }
        if (newTableName && table != newTableName) {
            sql += `\nRENAME TABLE ${table} TO ${newTableName};`
        }
        return sql;
    }
    pingDataBase(database: string): string {
        return "SELECT 1";
    }
    processList(): string {
        return `SELECT query_id AS "Id", user AS "User", address AS "Host", port AS "Port",
        "database" AS "db", query AS "Command", '' AS "State", elapsed AS "Time", query_kind AS "Info"
        FROM system.processes`;
    }
    variableList(): string {
        return `SELECT name, value FROM system.settings ORDER BY name`;
    }
    statusList(): string {
        return `SELECT metric AS name, toString(value) AS value FROM system.metrics ORDER BY metric`;
    }
    tableTemplate(): string {
        return `CREATE TABLE [name](
    id UInt64,
    create_time DateTime,
    [column] String
) ENGINE = MergeTree
ORDER BY id;`
    }
    viewTemplate(): string {
        return `CREATE VIEW [name]
AS
SELECT * FROM ...;`
    }
    procedureTemplate(): string {
        return `-- ClickHouse has no stored procedures.`
    }
    triggerTemplate(): string {
        return `-- ClickHouse has no triggers; a MaterializedView is the usual substitute.
CREATE MATERIALIZED VIEW [name]
TO [target_table]
AS
SELECT * FROM [source_table];`
    }
    functionTemplate(): string {
        return `CREATE FUNCTION [name] AS (x) -> x + 1;`
    }
}
