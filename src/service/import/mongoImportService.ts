import * as vscode from "vscode";
import { Console } from "@/common/Console";
import { Node } from "@/model/interface/node";
import { NodeUtil } from "@/model/nodeUtil";
import { exec } from "child_process";
import { ImportService } from "./importService";
import { ExternalTools } from "@/service/dependency/externalTools";

export class MongoImportService extends ImportService {

    public importSql(importPath: string, node: Node): void {

        const mongoimportBin = ExternalTools.resolve('mongoimport');
        if (mongoimportBin) {
            NodeUtil.of(node)
            const host = node.usingSSH ? "127.0.0.1" : node.host
            const port = node.usingSSH ? NodeUtil.getTunnelPort(node.getConnectId()) : node.port;
            const command = `"${mongoimportBin}" -h ${host}:${port} --db ${node.database} --jsonArray -c identitycounters --type json ${importPath}`
            Console.log(`Executing: ${command}`);
            exec(command, (err,stdout,stderr) => {
                if (err) {
                    Console.log(err);
                }else if(stderr){
                    Console.log(stderr);
                } else {
                    Console.log(`Import Success!`);
                }
            })
        } else {
            ExternalTools.require('mongoimport')
        }

    }

    public filter() {
        return { json: ['json'] }
    }


}