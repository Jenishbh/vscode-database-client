import { Global } from "@/common/global";
import { Node } from "@/model/interface/node";
import { ExternalTools } from "@/service/dependency/externalTools";
import { ChildProcess, spawn } from "child_process";
import { existsSync, readdirSync } from "fs";
import { delimiter, join } from "path";
import { IConnection, queryCallback } from "./connection";
import { JDBC_META } from "@/service/dialect/jdbcDialect";

interface Pending {
    resolve: (value: any) => void;
    reject: (err: Error) => void;
}

/**
 * Generic JDBC connection.
 *
 * Talks to a small Java helper (jdbc/JdbcBridge.java) over stdin/stdout using
 * one JSON document per line. The helper is shipped as readable source and is
 * launched with java's single file source mode, so there is no compiled binary
 * to trust and nothing is ever downloaded: common drivers ship with the
 * extension and the user supplies the JVM.
 */
export class JdbcConnection extends IConnection {

    private child: ChildProcess;
    private pending = new Map<number, Pending>();
    private seq = 0;
    private buffer = "";
    private ready = false;

    constructor(private node: Node) {
        super();
    }

    /**
     * Jar name fragments that serve a given jdbc url scheme. Handing the JVM a
     * single driver instead of every jar we ship cuts startup from ~30s to ~2s.
     */
    private static readonly JAR_HINTS: { scheme: RegExp, match: string[] }[] = [
        { scheme: /^jdbc:(postgresql|redshift|cockroach)/i, match: ["postgresql"] },
        { scheme: /^jdbc:mysql/i, match: ["mysql-connector"] },
        { scheme: /^jdbc:sqlserver/i, match: ["mssql-jdbc"] },
        { scheme: /^jdbc:oracle/i, match: ["ojdbc"] },
        { scheme: /^jdbc:(ch|clickhouse)/i, match: ["clickhouse"] },
        { scheme: /^jdbc:trino/i, match: ["trino"] },
        { scheme: /^jdbc:h2/i, match: ["h2-"] },
        { scheme: /^jdbc:duckdb/i, match: ["duckdb"] },
    ];

    /**
     * Driver jars: the ones shipped with the extension plus anything the user
     * dropped in the configured binary folder. Nothing is ever downloaded.
     *
     * When the url identifies a known driver only that driver is returned, so
     * the JVM does not scan unrelated jars. Anything unrecognised gets the full
     * set, which still works, just slower.
     */
    public static findDriverJars(jdbcUrl?: string): string[] {
        const dirs = [Global.getExtPath("jdbc", "drivers"), ExternalTools.getBinaryPath()];
        const jars: string[] = [];
        for (const dir of dirs) {
            if (!dir || !existsSync(dir)) continue;
            try {
                for (const f of readdirSync(dir)) {
                    if (f.toLowerCase().endsWith(".jar")) jars.push(join(dir, f));
                }
            } catch (err) {
                // an unreadable folder simply contributes no drivers
            }
        }
        if (!jdbcUrl) return jars;

        const hint = this.JAR_HINTS.find(h => h.scheme.test(jdbcUrl));
        if (!hint) return jars;
        const narrowed = jars.filter(j => {
            const base = j.toLowerCase();
            return hint.match.some(m => base.includes(m));
        });
        // a user supplied jar we cannot name-match must still be reachable
        return narrowed.length ? narrowed : jars;
    }

    /**
     * The runtime packaged with the extension, so JDBC works without the user
     * installing Java. Absent on a build where build/fetch-jre.js was not run,
     * and then whatever is on PATH is used instead.
     */
    public static bundledJava(): string {
        const exe = process.platform == "win32" ? "java.exe" : "java";
        const java = Global.getExtPath("jre", "bin", exe);
        return existsSync(java) ? java : null;
    }

    connect(callback: (err: Error) => void): void {
        let java = JdbcConnection.bundledJava();
        if (!java) {
            try {
                java = ExternalTools.require("java");
            } catch (err) {
                callback(err);
                return;
            }
        }

        // Prefer the classes compiled at build time: running those needs only a
        // JRE, while source mode compiles on every launch and needs a full JDK.
        const classes = Global.getExtPath("out", "jdbc-classes");
        const source = Global.getExtPath("jdbc", "JdbcBridge.java");
        const compiled = existsSync(classes);
        if (!compiled && !existsSync(source)) {
            callback(new Error(`JDBC bridge not found at ${classes} or ${source}`));
            return;
        }

        const jars = JdbcConnection.findDriverJars(this.node.jdbcUrl);
        if (jars.length == 0) {
            callback(new Error(
                `No JDBC driver jars found. Drivers ship with the extension; for others put the jar in the folder set by 'database-client.binaryPath', then run 'Database Client: Check External Tools'.`));
            return;
        }

        const args = compiled
            ? ["-cp", [...jars, classes].join(delimiter), "JdbcBridge"]
            : ["-cp", jars.join(delimiter), source];
        this.child = spawn(java, args, { stdio: ["pipe", "pipe", "pipe"] });
        this.child.stdout.setEncoding("utf8");
        this.child.stdout.on("data", chunk => this.onData(chunk));

        let stderr = "";
        this.child.stderr.setEncoding("utf8");
        this.child.stderr.on("data", chunk => { stderr += chunk; });

        this.child.on("error", err => this.failAll(err));
        this.child.on("exit", code => {
            this.ready = false;
            this.dead = true;
            const detail = stderr.trim().split("\n")[0] || `java exited with code ${code}`;
            this.failAll(new Error(detail));
        });

        this.send("connect", {
            url: this.node.jdbcUrl,
            driver: this.node.jdbcDriver,
            user: this.node.user,
            password: this.node.password,
        }).then(() => {
            this.ready = true;
            callback(null);
        }).catch(err => {
            this.dead = true;
            callback(err);
        });
    }

    query(sql: string, callback?: queryCallback): void;
    query(sql: string, values: any, callback?: queryCallback): void;
    query(sql: any, values?: any, callback?: any) {
        if (!callback && values instanceof Function) {
            callback = values;
        }
        if (typeof sql === "string" && sql.startsWith(JDBC_META)) {
            this.structure(sql, callback);
            return;
        }
        this.send("query", { sql, maxRows: Global.getConfig<number>("defaultSelectLimit", 500) })
            .then(res => {
                if (!callback) return;
                if (res.affectedRows !== undefined) {
                    callback(null, { affectedRows: res.affectedRows });
                    return;
                }
                const fields = (res.fields || []).map((f: any) => ({ name: f.name, orgTable: f.table, type: f.type }));
                const rows = (res.rows || []).map((row: any[]) => {
                    const obj: any = {};
                    fields.forEach((f: any, i: number) => { obj[f.name] = row[i]; });
                    return obj;
                });
                callback(null, rows, fields);
            })
            .catch(err => callback && callback(err));
    }

    /**
     * Answer a browse request from JDBC metadata rather than SQL.
     *
     * The tree passes one "database" name, but whether that is a catalog or a
     * schema depends on the engine, so try it as a catalog and fall back to
     * treating it as a schema when that yields nothing.
     */
    private structure(marker: string, callback?: queryCallback) {
        const [, op, first, second] = marker.split("\t");
        const ask = (catalog: string, schema: string) =>
            this.send("structure", { op, catalog, schema, table: second });

        const rowsOf = (res: any) => (res && res.rows) || [];

        // The tree hands us a single name, but it is a schema on SQL Server,
        // PostgreSQL and Oracle, and a catalog on MySQL. Try it as a schema
        // first: passing a non-existent catalog makes some drivers throw
        // ("Database 'dbo' does not exist"), whereas a wrong schema just
        // returns nothing.
        ask("", first)
            .then(res => rowsOf(res).length ? res : ask(first, "").catch(() => res))
            .catch(() => ask(first, ""))
            .then(res => callback && callback(null, rowsOf(res), []))
            .catch(err => callback && callback(err));
    }

    beginTransaction(callback: (err: Error) => void): void {
        this.send("query", { sql: "begin" }).then(() => callback(null)).catch(callback);
    }

    rollback(): void {
        this.send("query", { sql: "rollback" }).catch(() => { });
    }

    commit(): void {
        this.send("query", { sql: "commit" }).catch(() => { });
    }

    end(): void {
        if (this.dead) return;
        this.dead = true;
        this.ready = false;
        try {
            this.send("close", {}).catch(() => { });
            this.child?.stdin?.end();
            this.child?.kill();
        } catch (err) {
        }
    }

    isAlive(): boolean {
        return !this.dead && this.ready;
    }

    // ---------- transport ----------

    private send(action: string, body: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.child || this.child.killed) {
                reject(new Error("JDBC bridge is not running"));
                return;
            }
            const id = ++this.seq;
            this.pending.set(id, { resolve, reject });
            try {
                this.child.stdin.write(JSON.stringify({ id, action, ...body }) + "\n");
            } catch (err) {
                this.pending.delete(id);
                reject(err);
            }
        });
    }

    /** Responses are newline delimited, and a chunk may split one in half. */
    private onData(chunk: string) {
        this.buffer += chunk;
        let nl: number;
        while ((nl = this.buffer.indexOf("\n")) >= 0) {
            const line = this.buffer.slice(0, nl).trim();
            this.buffer = this.buffer.slice(nl + 1);
            if (!line) continue;
            let msg: any;
            try {
                msg = JSON.parse(line);
            } catch (err) {
                continue;
            }
            const p = this.pending.get(msg.id);
            if (!p) continue;
            this.pending.delete(msg.id);
            msg.ok ? p.resolve(msg) : p.reject(new Error(msg.error || "JDBC error"));
        }
    }

    private failAll(err: Error) {
        for (const [, p] of this.pending) p.reject(err);
        this.pending.clear();
    }

}
