import * as vscode from "vscode";
import { FieldInfo } from "@/common/typeDef";
import * as fs from "fs";
import { Console } from "../../common/Console";
import { ExportContext, ExportType } from "./exportContext";
import { ProgressLocation } from "vscode";
import { ConnectionManager } from "../connectionManager";
import { DatabaseType } from "@/common/constants";

export class ExportService {

    public export(context: ExportContext): Thenable<any> {
        if (context.openInEditor && context.type != ExportType.excel) {
            return new Promise((res) => {
                vscode.window.withProgress({ title: `Start exporting data...`, location: ProgressLocation.Notification }, () => {
                    return new Promise((resolve) => {
                        context.done = resolve
                        try {
                            this.exportToEditor(context)
                        } catch (error) {
                            resolve(null)
                        } finally {
                            res(null)
                        }
                    })
                })
            })
        }

        const randomFileName = `${new Date().getTime()}.${context.type}`

        return vscode.window.showSaveDialog({ saveLabel: "Select export file path", defaultUri: vscode.Uri.file(randomFileName), filters: { 'file': [context.type] } }).then((filePath) => {
            return new Promise((res, rej) => {
                if (filePath) {
                    context.exportPath = filePath.fsPath;
                    if (context.withOutLimit) {
                        context.sql = context.sql.replace(/\blimit\s.+/gi, "")
                    }
                    vscode.window.withProgress({ title: `Start exporting data to ${context.type}...`, location: ProgressLocation.Notification }, () => {
                        return new Promise((resolve) => {
                            context.done = resolve
                            try {
                                this.exportData(context)
                            } catch (error) {
                                resolve(null)
                            } finally {
                                res(null)
                            }
                        })
                    })
                } else {
                    res(null)
                }
            })
        })
    }


    private async exportData(context: ExportContext) {

        const sql = context.sql
        const connection = await ConnectionManager.getConnection(context.dbOption)
        connection.query(sql, (err, rows, fields?: FieldInfo[]) => {
            if (err) {
                Console.log(err)
                return;
            }
            this.delegateExport(context, rows, fields)
        })

    }

    private async exportToEditor(context: ExportContext) {
        if (context.withOutLimit) {
            context.sql = context.sql.replace(/\blimit\s.+/gi, "")
        }
        const sql = context.sql
        const connection = await ConnectionManager.getConnection(context.dbOption)
        connection.query(sql, async (err, rows, fields?: FieldInfo[]) => {
            if (err) {
                Console.log(err)
                context.done()
                return;
            }
            context.fields = fields;
            context.rows = rows;
            const content = this.buildContent(context, rows, fields);
            const language = context.type == ExportType.json ? 'json' : context.type == ExportType.sql ? 'sql' : context.type == ExportType.markdown ? 'markdown' : 'plaintext';
            const document = await vscode.workspace.openTextDocument({ content, language });
            await vscode.window.showTextDocument(document);
            context.done()
        })
    }

    private buildContent(context: ExportContext, rows: any, fields: FieldInfo[]): string {
        switch (context.type) {
            case ExportType.csv:
                return this.buildCsv(fields, rows);
            case ExportType.json:
                return this.buildJson(context);
            case ExportType.sql:
                return this.buildSql(context);
            case ExportType.markdown:
                return this.buildMarkdown(fields, rows);
        }
        return '';
    }

    private delegateExport(context: ExportContext, rows: any, fields: FieldInfo[]) {
        context.fields = fields;
        context.rows = rows;
        const filePath = context.exportPath;
        switch (context.type) {
            case ExportType.excel:
                this.exportByNodeXlsx(context, filePath, fields, rows);
                break;
            case ExportType.csv:
                this.exportToCsv(filePath, fields, rows);
                break;
            case ExportType.json:
                this.exportToJson(context);
                break;
            case ExportType.sql:
                this.exportToSql(context);
                break;
            case ExportType.markdown:
                this.exportToMarkdown(filePath, fields, rows);
                break;
        }
        context.done()
        vscode.window.showInformationMessage(`export ${context.type} success, path is ${context.exportPath}!`, 'Open').then(action => {
            if (action) {
                vscode.commands.executeCommand('vscode.open', vscode.Uri.file(context.exportPath));
            }
        })

    }

    private buildJson(context: ExportContext): string {
        return JSON.stringify(context.rows, (k, v: any) => {
            if (context.dbOption.dbType == DatabaseType.MONGO_DB && v.indexOf && v.indexOf("ObjectID") != -1) {
                return undefined;
            }
            return v === undefined ? null : v;
        }, 2);
    }

    private exportToJson(context: ExportContext) {
        fs.writeFileSync(context.exportPath, this.buildJson(context));
    }

    private buildSql(exportContext: ExportContext): string {
        const { rows } = exportContext;
        if (rows.length == 0) {
            return '';
        }
        let sql = ``;
        for (const row of rows) {
            let columns = "";
            let values = "";
            for (const key in row) {
                columns += `${key},`
                values += `${row[key] != null ? `'${row[key]}'` : 'null'},`
            }
            sql += `insert into ${exportContext.table}(${columns.replace(/.$/, '')}) values(${values.replace(/.$/, '')});\n`
        }
        return sql;
    }

    private exportToSql(exportContext: ExportContext) {

        const { exportPath } = exportContext;
        const sql = this.buildSql(exportContext);
        if (!sql) {
            // show waraing
            return;
        }
        fs.writeFileSync(exportPath, sql);


    }

    private exportByNodeXlsx(context: ExportContext, filePath: string, fields: FieldInfo[], rows: any) {
        const nodeXlsx = require('@/bin/node-xlsx');
        const sheets = [{
            name: "data",
            data: [
                fields.map((field) => field.name),
                ...rows.map((row) => {
                    const values = [];
                    for (const key in row) {
                        values.push(row[key]);
                    }
                    return values;
                })
            ]
        }];
        if (context.sheetSql) {
            sheets.push({ name: "sql", data: [[context.sql]] });
        }
        fs.writeFileSync(filePath, nodeXlsx.build(sheets), "binary");
    }

    private buildCsv(fields: FieldInfo[], rows: any): string {
        let csvContent = "";
        for (const row of rows) {
            for (const key in row) {
                csvContent += `${row[key] != null ? row[key] : ''},`
            }
            csvContent = csvContent.replace(/.$/, "") + "\n"
        }
        return csvContent;
    }

    private exportToCsv(filePath: string, fields: FieldInfo[], rows: any) {
        fs.writeFileSync(filePath, this.buildCsv(fields, rows), { encoding: "utf8" });
    }

    private buildMarkdown(fields: FieldInfo[], rows: any): string {
        if (!fields || fields.length == 0) {
            return '';
        }
        const headers = fields.map(field => field.name);
        let md = `| ${headers.join(' | ')} |\n`;
        md += `| ${headers.map(() => '---').join(' | ')} |\n`;
        for (const row of rows) {
            md += `| ${headers.map(h => row[h] != null ? String(row[h]).replace(/\|/g, '\\|') : '').join(' | ')} |\n`;
        }
        return md;
    }

    private exportToMarkdown(filePath: string, fields: FieldInfo[], rows: any) {
        fs.writeFileSync(filePath, this.buildMarkdown(fields, rows), { encoding: "utf8" });
    }


}
