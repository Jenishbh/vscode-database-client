import { S3Connection } from "@/service/connect/s3Connection";
import { ConnectionManager } from "@/service/connectionManager";
import { S3Client } from "@aws-sdk/client-s3";
import { Node } from "../interface/node";

export class S3BaseNode extends Node {

    constructor(label: string) {
        super(label)
    }

    public async getClient(): Promise<S3Client> {
        const s3Connection = await ConnectionManager.getConnection(this.parent) as S3Connection
        return s3Connection.getClient()
    }

}
