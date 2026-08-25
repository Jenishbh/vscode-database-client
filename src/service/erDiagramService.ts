import { Global } from "@/common/global";
import { Hanlder, ViewManager } from "@/common/viewManager";
import { DatabaseType } from "@/common/constants";
import { ColumnMeta, TableMeta } from "@/common/typeDef";
import { SchemaNode } from "@/model/database/schemaNode";

interface ErColumn {
    name: string;
    type: string;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
}

interface ErTable {
    name: string;
    columns: ErColumn[];
}

interface ErRelationship {
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
}

/**
 * Gathers ER diagram data (tables, columns, foreign key relationships) for one schema/database
 * and pushes it to the ER diagram webview. Reuses the existing showTables/showColumns/showForeignKeys
 * dialect methods -- no new schema-introspection SQL is written here.
 *
 * Only MySQL and PostgreSQL are wired up: those are the two dialects with real showForeignKeys
 * implementations. Everything else (SQL Server, SQLite, JDBC, Mongo, ES, ...) gets a clear
 * "not supported" message in the webview instead of an empty or broken diagram.
 */
export class ErDiagramService {

    private static readonly SUPPORTED_TYPES = [DatabaseType.MYSQL, DatabaseType.PG];

    public show(schemaNode: SchemaNode): void {
        ViewManager.createWebviewPanel({
            path: "app", title: `ER Diagram@${schemaNode.schema}`,
            splitView: false, iconPath: Global.getExtPath("resources", "icon", "diagram.svg"),
            eventHandler: (handler => {
                handler.on("init", () => {
                    handler.emit('route', 'er')
                }).on("route-er", async () => {
                    await this.loadAndEmit(schemaNode, handler)
                })
            })
        })
    }

    private async loadAndEmit(schemaNode: SchemaNode, handler: Hanlder): Promise<void> {
        const database = schemaNode.schema;
        if (ErDiagramService.SUPPORTED_TYPES.indexOf(schemaNode.dbType) == -1) {
            handler.emit('er-data', {
                supported: false,
                message: `ER diagram is not supported for ${schemaNode.dbType} databases.`,
                database, tables: [], relationships: [],
            });
            return;
        }
        try {
            const tableRows = await schemaNode.execute<TableMeta[]>(schemaNode.dialect.showTables(database));
            const tables: ErTable[] = [];
            const relationships: ErRelationship[] = [];
            for (const tableRow of (tableRows || [])) {
                const tableName = tableRow.name;
                const columnRows = await schemaNode.execute<ColumnMeta[]>(schemaNode.dialect.showColumns(database, tableName));
                let fkRows: any[] = [];
                const fkSql = schemaNode.dialect.showForeignKeys(database, tableName);
                if (fkSql) {
                    try {
                        fkRows = (await schemaNode.execute<any[]>(fkSql)) || [];
                    } catch {
                        fkRows = [];
                    }
                }
                const fkColumnNames = new Set(fkRows.map(fk => fk.column_name));
                // PostgreSQL's showColumns joins against constraint_column_usage, which fans out
                // into one row per constraint touching a column (PK, each referencing FK, checks, ...).
                // Collapse back to one row per column name, keeping the PRIMARY KEY flag if any row had it.
                const isPk = (column: ColumnMeta) => column.key == 'PRI' || column.key == 'PRIMARY KEY';
                const byColumnName = new Map<string, ColumnMeta>();
                for (const column of (columnRows || [])) {
                    const existing = byColumnName.get(column.name);
                    if (!existing || (isPk(column) && !isPk(existing))) {
                        byColumnName.set(column.name, column);
                    }
                }
                tables.push({
                    name: tableName,
                    columns: Array.from(byColumnName.values()).map(column => ({
                        name: column.name,
                        type: column.type,
                        isPrimaryKey: isPk(column),
                        isForeignKey: fkColumnNames.has(column.name),
                    })),
                });
                for (const fk of fkRows) {
                    relationships.push({
                        fromTable: tableName, fromColumn: fk.column_name,
                        toTable: fk.referenced_table, toColumn: fk.referenced_column,
                    });
                }
            }
            handler.emit('er-data', { supported: true, message: null, database, tables, relationships });
        } catch (error) {
            handler.emit('er-data', {
                supported: false,
                message: error?.message || "Failed to load schema for ER diagram.",
                database, tables: [], relationships: [],
            });
        }
    }

}
