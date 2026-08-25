import { CreateIndexParam } from "./param/createIndexParam";
import { UpdateColumnParam } from "./param/updateColumnParam";
import { UpdateTableParam } from "./param/updateTableParam";
import { SqlDialect } from "./sqlDialect";

/**
 * Oracle.
 *
 * Oracle has no "database" the way MySQL does: a connection targets one service,
 * and the schemas inside it are users. So schema == user throughout, and every
 * identifier is upper-cased because unquoted names fold to upper case.
 */
export class OracleDialect extends SqlDialect {

    private up(value: string): string {
        return (value || "").toUpperCase();
    }

    showDatabases(): string {
        return `SELECT username "Database" FROM all_users ORDER BY username`;
    }
    showSchemas(): string {
        return `SELECT username "Database", username "schema" FROM all_users ORDER BY username`;
    }
    showTables(database: string): string {
        return `SELECT t.table_name "name", c.comments "comment"
        FROM all_tables t
        LEFT JOIN all_tab_comments c ON c.owner = t.owner AND c.table_name = t.table_name
        WHERE t.owner = '${this.up(database)}' ORDER BY t.table_name`;
    }
    showViews(database: string): string {
        return `SELECT view_name "name" FROM all_views WHERE owner = '${this.up(database)}' ORDER BY view_name`;
    }
    showColumns(database: string, table: string): string {
        return `SELECT c.column_name "name", c.data_type "simpleType", c.data_type "type",
        c.nullable nullable, c.data_length "maxLength", c.data_default "defaultValue",
        cc.comments "comment", con.constraint_type "key"
        FROM all_tab_columns c
        LEFT JOIN all_col_comments cc ON cc.owner = c.owner AND cc.table_name = c.table_name AND cc.column_name = c.column_name
        LEFT JOIN (
            SELECT acc.owner, acc.table_name, acc.column_name, ac.constraint_type
            FROM all_cons_columns acc
            JOIN all_constraints ac ON ac.owner = acc.owner AND ac.constraint_name = acc.constraint_name
            WHERE ac.constraint_type = 'P'
        ) con ON con.owner = c.owner AND con.table_name = c.table_name AND con.column_name = c.column_name
        WHERE c.owner = '${this.up(database)}' AND c.table_name = '${this.up(table)}'
        ORDER BY c.column_id`;
    }
    showUsers(): string {
        return `SELECT username "user" FROM all_users ORDER BY username`;
    }
    createUser(): string {
        return `CREATE USER [name] IDENTIFIED BY [password]`;
    }
    showTriggers(database: string): string {
        return `SELECT trigger_name "TRIGGER_NAME" FROM all_triggers WHERE owner = '${this.up(database)}'`;
    }
    showTableTriggers(database: string, table: string): string {
        return `SELECT trigger_name, triggering_event AS event, trigger_type AS timing, table_name
        FROM all_triggers WHERE owner = '${this.up(database)}' AND table_name = '${this.up(table)}'`;
    }
    showProcedures(database: string): string {
        return `SELECT object_name "ROUTINE_NAME" FROM all_objects
        WHERE owner = '${this.up(database)}' AND object_type = 'PROCEDURE' ORDER BY object_name`;
    }
    showFunctions(database: string): string {
        return `SELECT object_name "ROUTINE_NAME" FROM all_objects
        WHERE owner = '${this.up(database)}' AND object_type = 'FUNCTION' ORDER BY object_name`;
    }
    showIndex(database: string, table: string): string {
        return `SELECT i.index_name "index_name", i.uniqueness || ' (' || LISTAGG(ic.column_name, ', ')
        WITHIN GROUP (ORDER BY ic.column_position) || ')' "indexdef"
        FROM all_indexes i
        JOIN all_ind_columns ic ON ic.index_owner = i.owner AND ic.index_name = i.index_name
        WHERE i.table_owner = '${this.up(database)}' AND i.table_name = '${this.up(table)}'
        GROUP BY i.index_name, i.uniqueness`;
    }
    createIndex(createIndexParam: CreateIndexParam): string {
        return `CREATE INDEX ${createIndexParam.column}_${new Date().getTime()}_index ON ${createIndexParam.table} (${createIndexParam.column})`;
    }
    dropIndex(table: string, indexName: string): string {
        return `DROP INDEX ${indexName}`;
    }
    showForeignKeys(database: string, table: string): string {
        return `SELECT ac.constraint_name, acc.column_name, rcc.table_name AS referenced_table,
        rcc.column_name AS referenced_column, 'NO ACTION' AS update_rule, ac.delete_rule
        FROM all_constraints ac
        JOIN all_cons_columns acc ON acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name
        JOIN all_cons_columns rcc ON rcc.owner = ac.r_owner AND rcc.constraint_name = ac.r_constraint_name
            AND rcc.position = acc.position
        WHERE ac.constraint_type = 'R' AND ac.owner = '${this.up(database)}' AND ac.table_name = '${this.up(table)}'`;
    }
    showChecks(database: string, table: string): string {
        return `SELECT constraint_name, search_condition AS check_clause FROM all_constraints
        WHERE constraint_type = 'C' AND owner = '${this.up(database)}' AND table_name = '${this.up(table)}'`;
    }
    showTableMeta(database: string, table: string): string {
        return `SELECT tablespace_name AS engine,
        (SELECT value FROM nls_database_parameters WHERE parameter = 'NLS_CHARACTERSET') AS collation
        FROM all_tables WHERE owner = '${this.up(database)}' AND table_name = '${this.up(table)}'`;
    }
    showTableSource(database: string, table: string): string {
        return `SELECT DBMS_METADATA.GET_DDL('TABLE', '${this.up(table)}', '${this.up(database)}') "Create Table" FROM dual`;
    }
    showViewSource(database: string, table: string): string {
        return `SELECT DBMS_METADATA.GET_DDL('VIEW', '${this.up(table)}', '${this.up(database)}') "Create View" FROM dual`;
    }
    showProcedureSource(database: string, name: string): string {
        return `SELECT DBMS_METADATA.GET_DDL('PROCEDURE', '${this.up(name)}', '${this.up(database)}') "Create Procedure" FROM dual`;
    }
    showFunctionSource(database: string, name: string): string {
        return `SELECT DBMS_METADATA.GET_DDL('FUNCTION', '${this.up(name)}', '${this.up(database)}') "Create Function" FROM dual`;
    }
    showTriggerSource(database: string, name: string): string {
        return `SELECT DBMS_METADATA.GET_DDL('TRIGGER', '${this.up(name)}', '${this.up(database)}') "SQL Original Statement" FROM dual`;
    }
    buildPageSql(database: string, table: string, pageSize: number): string {
        return `SELECT * FROM ${table} FETCH FIRST ${pageSize} ROWS ONLY`;
    }
    countSql(database: string, table: string): string {
        return `SELECT count(*) FROM ${table}`;
    }
    createDatabase(database: string): string {
        // A "database" in the tree is an Oracle schema, which is a user.
        return `CREATE USER ${database} IDENTIFIED BY [password]`;
    }
    truncateDatabase(database: string): string {
        return `SELECT 'TRUNCATE TABLE "' || table_name || '";' trun FROM all_tables WHERE owner = '${this.up(database)}'`;
    }
    addColumn(table: string): string {
        return `ALTER TABLE ${table} ADD ([column] [type])`;
    }
    updateColumn(table: string, column: string, type: string, comment: string, nullable: string): string {
        return `ALTER TABLE ${table} MODIFY (${column} ${type});
ALTER TABLE ${table} RENAME COLUMN ${column} TO [newColumnName];`;
    }
    updateColumnSql(updateColumnParam: UpdateColumnParam): string {
        const { columnName, columnType, newColumnName, comment, nullable, table } = updateColumnParam
        const nullableDefinition = nullable ? "NULL" : "NOT NULL";
        let sql = `ALTER TABLE ${table} MODIFY (${columnName} ${columnType} ${nullableDefinition});`;
        if (comment) {
            sql += `\nCOMMENT ON COLUMN ${table}.${columnName} IS '${comment}';`
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
            sql = `COMMENT ON TABLE ${table} IS '${newComment}';`;
        }
        if (newTableName && table != newTableName) {
            sql += `\nALTER TABLE ${table} RENAME TO ${newTableName};`
        }
        return sql;
    }
    pingDataBase(database: string): string {
        if (!database) {
            return "SELECT 1 FROM dual";
        }
        return `ALTER SESSION SET CURRENT_SCHEMA = ${database}`;
    }
    processList(): string {
        return `SELECT s.sid "Id", s.username "User", s.machine "Host", s.port "Port",
        s.schemaname "db", s.status "Command", s.state "State", s.last_call_et "Time", q.sql_text "Info"
        FROM v$session s LEFT JOIN v$sql q ON q.sql_id = s.sql_id
        WHERE s.type != 'BACKGROUND' ORDER BY s.sid`;
    }
    variableList(): string {
        return `SELECT name, value FROM v$parameter ORDER BY name`;
    }
    statusList(): string {
        return `SELECT name, value FROM v$sysstat ORDER BY name`;
    }
    tableTemplate(): string {
        return `CREATE TABLE [name](
    id NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    create_time DATE,
    update_time DATE,
    [column] VARCHAR2(255)
);
COMMENT ON TABLE [table] IS '[comment]';
COMMENT ON COLUMN [table].[column] IS '[comment]';`
    }
    viewTemplate(): string {
        return `CREATE VIEW [name]
AS
(SELECT * FROM ...);`
    }
    procedureTemplate(): string {
        return `CREATE OR REPLACE PROCEDURE [name] AS
BEGIN
    [content]
END;`
    }
    triggerTemplate(): string {
        return `CREATE OR REPLACE TRIGGER [name]
[BEFORE/AFTER] [INSERT/UPDATE/DELETE]
ON [table]
FOR EACH ROW
BEGIN
    [content]
END;`
    }
    dropTriggerTemplate(name: string): string {
        return `DROP TRIGGER ${name}`;
    }
    functionTemplate(): string {
        return `CREATE OR REPLACE FUNCTION [name]
RETURN [type] AS
BEGIN
    RETURN [value];
END;`
    }
}
