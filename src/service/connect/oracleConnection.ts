import { Node } from "@/model/interface/node";
import { EventEmitter } from "events";
import * as oracledb from "oracledb";
import { IConnection, queryCallback } from "./connection";

/**
 * Oracle via node-oracledb in Thin mode.
 *
 * Thin mode is pure JavaScript: it talks the Oracle Net protocol directly and
 * needs no Oracle Instant Client, so nothing has to be downloaded at runtime.
 * https://node-oracledb.readthedocs.io/en/latest/user_guide/appendix_a.html
 */
export class OracleConnection extends IConnection {
    private conn: oracledb.Connection;
    private config: oracledb.ConnectionAttributes;
    private inTransaction = false;

    constructor(node: Node) {
        super()
        // Oracle addresses a service (or SID), not a "database" in the MySQL sense.
        // Fall back to the database field so an existing connection still works.
        const service = node.serviceName || node.database;
        this.config = {
            user: node.user,
            password: node.password,
            connectString: `${node.host}:${node.port}/${service}`,
        }
    }

    connect(callback: (err: Error) => void): void {
        oracledb.getConnection(this.config).then(conn => {
            this.conn = conn;
            callback(null)
        }).catch(err => callback(err))
    }

    isAlive(): boolean {
        return !this.dead && this.conn != null;
    }

    query(sql: string, callback?: queryCallback): void;
    query(sql: string, values: any, callback?: queryCallback): void;
    query(sql: any, values?: any, callback?: any) {
        if (!callback && values instanceof Function) {
            callback = values;
            values = undefined;
        }
        const event = new EventEmitter()

        // The editor sends statements with a trailing semicolon, which Oracle
        // rejects for anything that is not an anonymous PL/SQL block.
        const trimmed = this.stripTerminator(sql);

        this.conn.execute(trimmed, values || [], {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
            autoCommit: !this.inTransaction,
        }).then(res => {
            if (!callback) {
                const rows = res.rows || [];
                if (rows.length == 0) {
                    event.emit("end")
                }
                for (let i = 1; i <= rows.length; i++) {
                    event.emit("result", this.convertToDump(rows[i - 1]), rows.length == i)
                }
                return;
            }
            if (res.metaData) {
                callback(null, res.rows, this.adaptFields(res.metaData))
            } else {
                callback(null, { affectedRows: res.rowsAffected || 0 })
            }
        }).catch(err => {
            if (callback) callback(err)
            event.emit("error", err.message)
        })

        return event;
    }

    /**
     * Oracle only accepts a trailing semicolon on PL/SQL blocks.
     */
    private stripTerminator(sql: string): string {
        const trimmed = (sql || "").trim();
        if (/^\s*(declare|begin)\b/i.test(trimmed)) {
            return trimmed;
        }
        return trimmed.replace(/;+$/, "");
    }

    private adaptFields(metaData: oracledb.Metadata<any>[]) {
        return metaData.map(meta => ({
            name: meta.name,
            orgTable: null,
        })) as any;
    }

    beginTransaction(callback: (err: Error) => void): void {
        // Oracle opens a transaction implicitly; suppressing autoCommit is enough.
        this.inTransaction = true;
        callback(null)
    }

    async rollback() {
        this.inTransaction = false;
        try { await this.conn.rollback() } catch (err) { }
    }

    async commit() {
        this.inTransaction = false;
        try { await this.conn.commit() } catch (err) { }
    }

    end(): void {
        if (this.dead) return;
        this.dead = true;
        try {
            this.conn.close()
        } catch (err) {
        }
    }
}
