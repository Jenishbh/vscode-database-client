import { Node } from "@/model/interface/node";
import EventEmitter = require("events");
import { S3Client } from "@aws-sdk/client-s3";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { IConnection, queryCallback } from "./connection";

/**
 * S3 is a stateless HTTP API, not a socket connection like the SQL drivers.
 * "connect" just means: build a client and prove the credentials/endpoint
 * work with one cheap call, mirroring how EsConnection pings /_cluster/health.
 */
export class S3Connection extends IConnection {

    private client: S3Client;
    private connected: boolean = false;

    constructor(private node: Node) {
        super()
        this.client = new S3Client({
            endpoint: node.s3Endpoint,
            region: node.s3Region || "us-east-1",
            forcePathStyle: node.s3ForcePathStyle !== false,
            credentials: {
                accessKeyId: node.s3AccessKey,
                secretAccessKey: node.s3SecretKey,
            },
            requestHandler: {
                requestTimeout: node.connectTimeout || 10000,
            } as any,
        });
    }

    public getClient(): S3Client {
        return this.client;
    }

    query(sql: string, callback?: queryCallback): void | EventEmitter;
    query(sql: string, values: any, callback?: queryCallback): void | EventEmitter;
    query(sql: any, values?: any, callback?: any) {
        throw new Error("Method not implemented.");
    }

    connect(callback: (err: Error) => void): void {
        this.client.send(new ListBucketsCommand({})).then(() => {
            this.connected = true;
            callback(null);
        }).catch((err: Error) => {
            this.connected = false;
            callback(err);
        });
    }

    beginTransaction(callback: (err: Error) => void): void {
        throw new Error("Method not implemented.");
    }
    rollback(): void {
        throw new Error("Method not implemented.");
    }
    commit(): void {
        throw new Error("Method not implemented.");
    }
    end(): void {
        this.client.destroy();
        this.connected = false;
    }
    isAlive(): boolean {
        return this.connected;
    }

}
