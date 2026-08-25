import { Constants, ModelType } from '@/common/constants';
import { FileManager, FileModel } from '@/common/filesManager';
import { GetObjectCommand, _Object } from '@aws-sdk/client-s3';
import { createWriteStream } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { TreeItemCollapsibleState } from "vscode";
import { Node } from '../interface/node';
import { S3BaseNode } from './s3BaseNode';

const prettyBytes = require('pretty-bytes');

export class S3ObjectNode extends S3BaseNode {
    contextValue = ModelType.S3_OBJECT;
    fullPath: string;
    bucket: string;

    constructor(readonly name: string, parent: Node, bucket: string, private object: _Object) {
        super(name);
        this.init(parent);
        this.bucket = bucket;
        this.fullPath = object.Key;
        this.collapsibleState = TreeItemCollapsibleState.None;
        this.description = prettyBytes(object.Size || 0);
        this.iconPath = this.getIcon(this.name);
        this.command = {
            command: "jenishbh.ssh.file.open",
            arguments: [this],
            title: "Open File"
        };
    }

    public async getChildren(): Promise<Node[]> {
        return [];
    }

    async open() {
        if (this.object.Size && this.object.Size > 10485760) {
            vscode.window.showErrorMessage("File size except 10 MB, not support open!");
            return;
        }
        const extName = path.extname(this.name).toLowerCase();
        if (extName == ".gz" || extName == ".exe" || extName == ".7z" || extName == ".jar" || extName == ".bin" || extName == ".tar") {
            vscode.window.showErrorMessage(`Not support open ${extName} file!`);
            return;
        }
        try {
            const client = await this.getClient();
            const res = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.fullPath }));
            const tempPath = await FileManager.record(`temp/${this.name}`, null, FileModel.WRITE);
            const body = res.Body as NodeJS.ReadableStream;
            body.pipe(createWriteStream(tempPath)).on("close", () => {
                vscode.commands.executeCommand('vscode.open', vscode.Uri.file(tempPath));
            });
        } catch (err) {
            vscode.window.showErrorMessage(err.message);
        }
    }

    getIcon(fileName: string): string {
        const extPath = `${Constants.RES_PATH}`;
        const ext = path.extname(fileName).replace(".", "").toLowerCase();
        let fileIcon: string;
        switch (ext) {
            case 'pub': case 'pem': fileIcon = "key.svg"; break;
            case 'ts': fileIcon = "typescript.svg"; break;
            case 'log': fileIcon = "log.svg"; break;
            case 'sql': fileIcon = "sql.svg"; break;
            case 'xml': fileIcon = "xml.svg"; break;
            case 'html': fileIcon = "html.svg"; break;
            case 'java': case 'class': fileIcon = "java.svg"; break;
            case 'js': case 'map': fileIcon = "javascript.svg"; break;
            case 'yml': case 'yaml': fileIcon = "yaml.svg"; break;
            case 'json': fileIcon = "json.svg"; break;
            case 'sh': fileIcon = "console.svg"; break;
            case 'cfg': case 'conf': fileIcon = "settings.svg"; break;
            case 'rar': case 'zip': case '7z': case 'gz': case 'tar': fileIcon = "zip.svg"; break;
            default: fileIcon = "file.svg"; break;
        }
        return `${extPath}/ssh/${fileIcon}`;
    }

}
