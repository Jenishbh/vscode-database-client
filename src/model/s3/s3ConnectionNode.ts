import { ConfigKey, ModelType } from "@/common/constants";
import { Global } from "@/common/global";
import { Util } from "@/common/util";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import * as vscode from "vscode";
import { TreeItemCollapsibleState } from "vscode";
import { CommandKey, Node } from "../interface/node";
import { InfoNode } from "../other/infoNode";
import { S3BaseNode } from "./s3BaseNode";
import { S3BucketNode } from "./s3BucketNode";

export class S3ConnectionNode extends S3BaseNode {

    contextValue = ModelType.S3_CONNECTION;
    constructor(readonly key: string, readonly parent: Node) {
        super(key);
        this.contextValue = ModelType.S3_CONNECTION;
        this.init(parent);
        this.iconPath = new vscode.ThemeIcon("cloud");
        this.label = this.s3Endpoint || key;
        if (parent.name) {
            this.name = parent.name;
            const preferName = Global.getConfig(ConfigKey.PREFER_CONNECTION_NAME, true);
            preferName ? this.label = parent.name : this.description = parent.name;
        }
        if (this.disable) {
            this.collapsibleState = TreeItemCollapsibleState.None;
            this.description = (this.description || '') + " closed";
        }
    }

    public async deleteConnection(context: vscode.ExtensionContext) {
        Util.confirm(`Are you sure you want to Delete Connection ${this.label} ? `, async () => {
            this.indent({ command: CommandKey.delete });
        });
    }

    public copyIP() {
        Util.copyToBoard(this.s3Endpoint);
    }

    getChildren(): Promise<Node[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const client = await this.getClient();
                const result = await client.send(new ListBucketsCommand({}));
                const buckets = result.Buckets || [];
                if (buckets.length == 0) {
                    resolve([new InfoNode("There are no buckets on this endpoint. (empty)")]);
                    return;
                }
                const nodes = buckets
                    .filter(b => !!b.Name)
                    .map(b => new S3BucketNode(b.Name, this, b.Name))
                    .sort((a, b) => a.label.localeCompare(b.label));
                resolve(nodes);
            } catch (error) {
                resolve([new InfoNode(error)]);
            }
        });
    }

}
