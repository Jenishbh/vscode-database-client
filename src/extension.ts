"use strict";

import * as vscode from "vscode";
import { CodeCommand } from "./common/constants";
import { ConnectionNode } from "./model/database/connectionNode";
import { SchemaNode } from "./model/database/schemaNode";
import { UserGroup } from "./model/database/userGroup";
import { CopyAble } from "./model/interface/copyAble";
import { FunctionNode } from "./model/main/function";
import { FunctionGroup } from "./model/main/functionGroup";
import { ProcedureNode } from "./model/main/procedure";
import { ProcedureGroup } from "./model/main/procedureGroup";
import { TableGroup } from "./model/main/tableGroup";
import { TableNode } from "./model/main/tableNode";
import { TriggerNode } from "./model/main/trigger";
import { TriggerGroup } from "./model/main/triggerGroup";
import { ViewGroup } from "./model/main/viewGroup";
import { ViewNode } from "./model/main/viewNode";
import { ColumnNode } from "./model/other/columnNode";
import { Console } from "./common/Console";
import { ExternalTools } from "./service/dependency/externalTools";
// Don't change last order, it will occur circular reference
import { ServiceManager } from "./service/serviceManager";
import { QueryUnit } from "./service/queryUnit";
import { FileManager } from "./common/filesManager";
import { ConnectionManager } from "./service/connectionManager";
import { QueryNode } from "./model/query/queryNode";
import { QueryGroup } from "./model/query/queryGroup";
import { Node } from "./model/interface/node";
import { DbTreeDataProvider } from "./provider/treeDataProvider";
import { UserNode } from "./model/database/userNode";
import { EsConnectionNode } from "./model/es/model/esConnectionNode";
import { ESIndexNode } from "./model/es/model/esIndexNode";
import { activeEs } from "./model/es/provider/main";
import { RedisConnectionNode } from "./model/redis/redisConnectionNode";
import KeyNode from "./model/redis/keyNode";
import { DiffService } from "./service/diff/diffService";
import { DatabaseCache } from "./service/common/databaseCache";
import { FileNode } from "./model/ssh/fileNode";
import { SSHConnectionNode } from "./model/ssh/sshConnectionNode";
import { FTPFileNode } from "./model/ftp/ftpFileNode";
import { HistoryNode } from "./provider/history/historyNode";
import { ConnectService } from "./service/connect/connectService";
import { ErDiagramService } from "./service/erDiagramService";

export function activate(context: vscode.ExtensionContext) {

    const serviceManager = new ServiceManager(context)

    activeEs(context)

    ConnectionNode.init()
    context.subscriptions.push(
        ...serviceManager.init(),
        vscode.window.onDidChangeActiveTextEditor(detectActive),
        ConnectService.listenConfig(),
        ...initCommand({
            // util
            ...{
                [CodeCommand.Refresh]: async (node: Node) => {
                    if (node) {
                        await node.getChildren(true)
                    } else {
                        DatabaseCache.clearCache()
                    }
                    DbTreeDataProvider.refresh(node)
                },
                [CodeCommand.RecordHistory]: (sql: string, costTime: number) => {
                    serviceManager.historyService.recordHistory(sql, costTime);
                },
                "jenishbh.history.open": () => serviceManager.historyService.showHistory(),
                "jenishbh.setting.open": () => {
                    serviceManager.settingService.open();
                },
                "jenishbh.server.info": (connectionNode: ConnectionNode) => {
                    serviceManager.statusService.show(connectionNode)
                },
                "jenishbh.name.copy": (copyAble: CopyAble) => {
                    copyAble.copyName();
                },
            },
            // connection
            ...{
                "jenishbh.connection.add": () => {
                    serviceManager.connectService.openConnect(serviceManager.provider)
                },
                "jenishbh.connection.edit": (connectionNode: ConnectionNode) => {
                    serviceManager.connectService.openConnect(connectionNode.provider, connectionNode)
                },
                "jenishbh.connection.config": () => {
                    serviceManager.connectService.openConfig()
                },
                "jenishbh.connection.open": (connectionNode: ConnectionNode) => {
                    connectionNode.provider.openConnection(connectionNode)
                },
                "jenishbh.connection.disable": (connectionNode: ConnectionNode) => {
                    connectionNode.provider.disableConnection(connectionNode)
                },
                "jenishbh.connection.delete": (connectionNode: ConnectionNode) => {
                    connectionNode.deleteConnection(context);
                },
                "jenishbh.host.copy": (connectionNode: ConnectionNode) => {
                    connectionNode.copyName();
                },
            },
            // externel data
            ...{
                "jenishbh.connection.import": () => {
                    ConnectService.importConfig();
                },
                "jenishbh.dependency.check": () => {
                    ExternalTools.check();
                },
                "jenishbh.util.github": () => {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/jenishbh/vscode-database-client'));
                },
                "jenishbh.struct.diff": () => {
                    new DiffService().startDiff(serviceManager.provider);
                },
                "jenishbh.data.export": (node: SchemaNode | TableNode) => {
                    ServiceManager.getDumpService(node.dbType).dump(node, true)
                },
                "jenishbh.struct.export": (node: SchemaNode | TableNode) => {
                    ServiceManager.getDumpService(node.dbType).dump(node, false)
                },
                "jenishbh.document.generate": (node: SchemaNode | TableNode) => {
                    ServiceManager.getDumpService(node.dbType).generateDocument(node)
                },
                "jenishbh.data.import": (node: SchemaNode | ConnectionNode) => {
                    const importService=ServiceManager.getImportService(node.dbType);
                    vscode.window.showOpenDialog({ filters: importService.filter(), canSelectMany: false, openLabel: "Select sql file to import", canSelectFiles: true, canSelectFolders: false }).then((filePath) => {
                        if (filePath) {
                            importService.importSql(filePath[0].fsPath, node)
                        }
                    });
                },
            },
            // ssh
            ...{
                'jenishbh.ssh.folder.new': (parentNode: SSHConnectionNode) => parentNode.newFolder(),
                'jenishbh.ssh.file.new': (parentNode: SSHConnectionNode) => parentNode.newFile(),
                'jenishbh.ssh.host.copy': (parentNode: SSHConnectionNode) => parentNode.copyIP(),
                'jenishbh.ssh.forward.port': (parentNode: SSHConnectionNode) => parentNode.fowardPort(),
                'jenishbh.ssh.file.upload': (parentNode: SSHConnectionNode) => parentNode.upload(),
                'jenishbh.ssh.folder.open': (parentNode: SSHConnectionNode) => parentNode.openInTeriminal(),
                'jenishbh.ssh.path.copy': (node: Node) => node.copyName(),
                'jenishbh.ssh.socks.port': (parentNode: SSHConnectionNode) => parentNode.startSocksProxy(),
                'jenishbh.ssh.file.delete': (fileNode: FileNode | SSHConnectionNode) => fileNode.delete(),
                'jenishbh.ssh.file.open': (fileNode: FileNode | FTPFileNode) => fileNode.open(),
                'jenishbh.ssh.file.download': (fileNode: FileNode) => fileNode.download(),
            },
            // database
            ...{
                "jenishbh.db.active": () => {
                    serviceManager.provider.activeDb();
                },
                "jenishbh.db.truncate": (databaseNode: SchemaNode) => {
                    databaseNode.truncateDb();
                },
                "jenishbh.database.add": (connectionNode: ConnectionNode) => {
                    connectionNode.createDatabase();
                },
                "jenishbh.db.drop": (databaseNode: SchemaNode) => {
                    databaseNode.dropDatatabase();
                },
                "jenishbh.schema.erDiagram": (databaseNode: SchemaNode) => {
                    new ErDiagramService().show(databaseNode);
                }
            },
            // mock
            ...{
                "jenishbh.mock.table": (tableNode: TableNode) => {
                    serviceManager.mockRunner.create(tableNode)
                },
                "jenishbh.mock.run": () => {
                    serviceManager.mockRunner.runMock()
                },
            },
            // user node
            ...{
                "jenishbh.change.user": (userNode: UserNode) => {
                    userNode.changePasswordTemplate();
                },
                "jenishbh.user.grant": (userNode: UserNode) => {
                    userNode.grandTemplate();
                },
                "jenishbh.user.sql": (userNode: UserNode) => {
                    userNode.selectSqlTemplate();
                },
            },
            // history
            ...{
                "jenishbh.history.view": (historyNode: HistoryNode) => {
                    historyNode.view()
                }
            },
            // query node
            ...{
                "jenishbh.runQuery": (sql:string) => {
                    if (typeof sql != 'string') { sql = null; }
                    QueryUnit.runQuery(sql, ConnectionManager.tryGetConnection());
                },
                "jenishbh.runQuery.newTab": (sql: string) => {
                    // a unique viewId forces a fresh result panel instead of reusing "Query"
                    QueryUnit.runQuery(sql, ConnectionManager.tryGetConnection(), { viewId: `Query-${Date.now()}` });
                },
                "jenishbh.runAllQuery.noParse": () => {
                    // split:false sends the buffer as one statement, skipping delimiter parsing
                    QueryUnit.runQuery(null, ConnectionManager.tryGetConnection(), { runAll: true, split: false });
                },
                "jenishbh.runAllQuery": () => {
                    QueryUnit.runQuery(null, ConnectionManager.tryGetConnection(), { runAll: true });
                },
                "jenishbh.query.switch": async (databaseOrConnectionNode: SchemaNode | ConnectionNode | EsConnectionNode | ESIndexNode) => {
                    if (databaseOrConnectionNode) {
                        await databaseOrConnectionNode.newQuery();
                    } else {
                        vscode.workspace.openTextDocument({ language: 'sql' }).then(async (doc) => {
                            vscode.window.showTextDocument(doc)
                        });
                    }
                },
                "jenishbh.query.run": (queryNode: QueryNode) => {
                    queryNode.run()
                },
                "jenishbh.query.open": (queryNode: QueryNode) => {
                    queryNode.open()
                },
                "jenishbh.query.add": (queryGroup: QueryGroup) => {
                    queryGroup.add();
                },
                "jenishbh.query.rename": (queryNode: QueryNode) => {
                    queryNode.rename()
                }
            },
            // redis
            ...{
                "jenishbh.redis.connection.status": (connectionNode: RedisConnectionNode) => connectionNode.showStatus(),
                "jenishbh.connection.terminal": (node: Node) => node.openTerminal(),
                "jenishbh.redis.key.detail": (keyNode: KeyNode) => keyNode.detail(),
                "jenishbh.redis.key.del": (keyNode: KeyNode) => keyNode.delete(),
            },
            // table node
            ...{
                "jenishbh.show.esIndex": (indexNode: ESIndexNode) => {
                    indexNode.viewData()
                },
                "jenishbh.table.truncate": (tableNode: TableNode) => {
                    tableNode.truncateTable();
                },
                "jenishbh.table.drop": (tableNode: TableNode) => {
                    tableNode.dropTable();
                },
                "jenishbh.table.source": (tableNode: TableNode) => {
                    if (tableNode) { tableNode.showSource(); }
                },
                "jenishbh.view.source": (tableNode: TableNode) => {
                    if (tableNode) { tableNode.showSource(); }
                },
                "jenishbh.table.show": (tableNode: TableNode) => {
                    if (tableNode) { tableNode.openInNew(); }
                },
            },
            // column node
            ...{
                "jenishbh.column.up": (columnNode: ColumnNode) => {
                    columnNode.moveUp();
                },
                "jenishbh.column.down": (columnNode: ColumnNode) => {
                    columnNode.moveDown();
                },
                "jenishbh.column.add": (tableNode: TableNode) => {
                    tableNode.addColumnTemplate();
                },
                "jenishbh.column.update": (columnNode: ColumnNode) => {
                    columnNode.updateColumnTemplate();
                },
                "jenishbh.column.drop": (columnNode: ColumnNode) => {
                    columnNode.dropColumnTemplate();
                },
            },
            // template
            ...{
                "jenishbh.table.find": (tableNode: TableNode) => {
                    tableNode.openTable();
                },
                "jenishbh.codeLens.run": (sql: string) => {
                    QueryUnit.runQuery(sql, ConnectionManager.tryGetConnection(), { split: true, recordHistory: true })
                },
                "jenishbh.table.design": (tableNode: TableNode) => {
                    tableNode.designTable();
                },
            },
            // show source
            ...{
                "jenishbh.show.procedure": (procedureNode: ProcedureNode) => {
                    procedureNode.showSource();
                },
                "jenishbh.show.function": (functionNode: FunctionNode) => {
                    functionNode.showSource();
                },
                "jenishbh.show.trigger": (triggerNode: TriggerNode) => {
                    triggerNode.showSource();
                },
            },
            // create template
            ...{
                "jenishbh.template.sql": (tableNode: TableNode) => {
                    tableNode.selectSqlTemplate();
                },
                "jenishbh.template.table": (tableGroup: TableGroup) => {
                    tableGroup.createTemplate();
                },
                "jenishbh.template.procedure": (procedureGroup: ProcedureGroup) => {
                    procedureGroup.createTemplate();
                },
                "jenishbh.template.view": (viewGroup: ViewGroup) => {
                    viewGroup.createTemplate();
                },
                "jenishbh.template.trigger": (triggerGroup: TriggerGroup) => {
                    triggerGroup.createTemplate();
                },
                "jenishbh.template.function": (functionGroup: FunctionGroup) => {
                    functionGroup.createTemplate();
                },
                "jenishbh.template.user": (userGroup: UserGroup) => {
                    userGroup.createTemplate();
                },
            },
            // drop template
            ...{
                "jenishbh.delete.user": (userNode: UserNode) => {
                    userNode.drop();
                },
                "jenishbh.delete.view": (viewNode: ViewNode) => {
                    viewNode.drop();
                },
                "jenishbh.delete.procedure": (procedureNode: ProcedureNode) => {
                    procedureNode.drop();
                },
                "jenishbh.delete.function": (functionNode: FunctionNode) => {
                    functionNode.drop();
                },
                "jenishbh.delete.trigger": (triggerNode: TriggerNode) => {
                    triggerNode.drop();
                },
            },
        }),
    );

}

export function deactivate() {
}

function detectActive(): void {
    const fileNode = ConnectionManager.getByActiveFile();
    if (fileNode) {
        ConnectionManager.changeActive(fileNode);
    }
}

function commandWrapper(commandDefinition: any, command: string): (...args: any[]) => any {
    return (...args: any[]) => {
        try {
            commandDefinition[command](...args);
        }catch (err) {
            Console.log(err);
        }
    };
}

function initCommand(commandDefinition: any): vscode.Disposable[] {

    const dispose = []

    for (const command in commandDefinition) {
        if (commandDefinition.hasOwnProperty(command)) {
            dispose.push(vscode.commands.registerCommand(command, commandWrapper(commandDefinition, command)))
        }
    }

    return dispose;
}


// refrences
// - when : https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts