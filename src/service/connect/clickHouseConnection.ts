import { Node } from "@/model/interface/node";
import { ClickHouseClient, createClient } from "@clickhouse/client";
import { EventEmitter } from "events";
import { IConnection, queryCallback } from "./connection";

/**
 * ClickHouse over its HTTP interface.
 *
 * The official client splits reads (query) from writes (command), so this
 * routes on the statement itself. ClickHouse has no interactive transactions,
 * and UPDATE/DELETE are asynchronous mutations, so mutations_sync makes them
 * behave the way the result grid expects: by the time the callback fires, a
 * follow-up SELECT sees the change.
 */
export class ClickHouseConnection extends IConnection {
    private client: ClickHouseClient;

    constructor(node: Node) {
        super()
        const protocol = node.useSSL ? "https" : "http";
        this.client = createClient({
            url: `${protocol}://${node.host}:${node.port}`,
            username: node.user,
            password: node.password || "",
            database: node.database || "default",
            request_timeout: node.requestTimeout || 30000,
        })
    }

    connect(callback: (err: Error) => void): void {
        this.client.ping()
            .then(res => callback(res.success ? null : (res as any).error))
            .catch(err => callback(err))
    }

    isAlive(): boolean {
        return !this.dead;
    }

    query(sql: string, callback?: queryCallback): void;
    query(sql: string, values: any, callback?: queryCallback): void;
    query(sql: any, values?: any, callback?: any) {
        if (!callback && values instanceof Function) {
            callback = values;
        }
        const event = new EventEmitter()
        const trimmed = (sql || "").trim().replace(/;+$/, "");

        this.run(trimmed).then(({ rows, fields, affectedRows }) => {
            if (!callback) {
                if (!rows || rows.length == 0) {
                    event.emit("end")
                }
                for (let i = 1; rows && i <= rows.length; i++) {
                    event.emit("result", this.convertToDump(rows[i - 1]), rows.length == i)
                }
                return;
            }
            if (rows) {
                callback(null, rows, fields)
            } else {
                callback(null, { affectedRows })
            }
        }).catch(err => {
            if (callback) callback(err)
            event.emit("error", err.message)
        })

        return event;
    }

    private async run(sql: string): Promise<{ rows?: any[], fields?: any[], affectedRows?: number }> {
        if (this.returnsRows(sql)) {
            const res = await this.client.query({ query: sql, format: "JSON" })
            const body: any = await res.json()
            return {
                rows: body.data,
                fields: (body.meta || []).map((m: any) => ({ name: m.name, orgTable: null })),
            }
        }
        await this.client.command({
            query: sql,
            // wait for mutations so a follow-up read is consistent
            clickhouse_settings: { mutations_sync: "1" },
        })
        return { affectedRows: 0 };
    }

    private returnsRows(sql: string): boolean {
        return /^\s*(select|show|describe|desc|exists|explain|with)\b/i.test(sql);
    }

    beginTransaction(callback: (err: Error) => void): void {
        // ClickHouse has no interactive transactions; statements are atomic per part.
        callback(null)
    }

    rollback(): void {
        // no-op: see beginTransaction
    }

    commit(): void {
        // no-op: see beginTransaction
    }

    end(): void {
        if (this.dead) return;
        this.dead = true;
        try {
            this.client.close()
        } catch (err) {
        }
    }
}
