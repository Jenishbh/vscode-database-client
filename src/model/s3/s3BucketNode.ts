import { ModelType } from "@/common/constants";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import * as vscode from "vscode";
import { TreeItemCollapsibleState } from "vscode";
import { Node } from "../interface/node";
import { InfoNode } from "../other/infoNode";
import { S3BaseNode } from "./s3BaseNode";
import { S3ObjectNode } from "./s3ObjectNode";

/**
 * Doubles as the bucket root and as a "folder" (a common prefix) inside it,
 * the same way FTPConnectionNode doubles as connection root and folder --
 * S3 has no real directories, so a folder is just everything sharing a
 * prefix up to the next "/".
 */
export class S3BucketNode extends S3BaseNode {

    contextValue = ModelType.S3_BUCKET;
    bucket: string;
    /** key prefix this node represents within the bucket; "" at the bucket root */
    fullPath: string;

    constructor(readonly key: string, readonly parent: Node, bucketName: string, prefix: string = "") {
        super(key);
        this.bucket = bucketName;
        this.fullPath = prefix;
        const isBucketRoot = parent.contextValue == ModelType.S3_CONNECTION;
        this.contextValue = isBucketRoot ? ModelType.S3_BUCKET : ModelType.S3_FOLDER;
        this.init(parent);
        this.label = key;
        this.iconPath = new vscode.ThemeIcon(isBucketRoot ? "archive" : "folder");
        if (this.disable) {
            this.collapsibleState = TreeItemCollapsibleState.None;
        }
    }

    getChildren(): Promise<Node[]> {
        return new Promise(async (resolve) => {
            try {
                const client = await this.getClient();
                const result = await client.send(new ListObjectsV2Command({
                    Bucket: this.bucket,
                    Prefix: this.fullPath,
                    Delimiter: "/",
                }));

                const folders = (result.CommonPrefixes || [])
                    .filter(cp => !!cp.Prefix)
                    .map(cp => {
                        const name = cp.Prefix.slice(this.fullPath.length).replace(/\/$/, "");
                        return new S3BucketNode(name, this, this.bucket, cp.Prefix);
                    });

                const objects = (result.Contents || [])
                    // a zero-byte object whose key equals the prefix is just a folder marker
                    .filter(o => !!o.Key && o.Key !== this.fullPath)
                    .map(o => new S3ObjectNode(o.Key.slice(this.fullPath.length), this, this.bucket, o));

                if (folders.length == 0 && objects.length == 0) {
                    resolve([new InfoNode("There are no objects in this location. (empty)")]);
                    return;
                }

                resolve(([] as Node[])
                    .concat(folders.sort((a, b) => a.label.localeCompare(b.label)))
                    .concat(objects.sort((a, b) => a.label.localeCompare(b.label))));
            } catch (error) {
                resolve([new InfoNode(error)]);
            }
        });
    }

}
