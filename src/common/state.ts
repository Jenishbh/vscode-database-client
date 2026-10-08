import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import * as vscode from "vscode";

/**
 * Connections, query history and tree collapse state used to live in
 * context.globalState. VS Code keeps that in its own state database and does
 * not clear it when an extension is uninstalled, so connection details --
 * passwords included -- outlived the extension and came back on reinstall.
 *
 * Keeping them in a file under the extension's storage folder fixes that at
 * the source: VS Code deletes that folder itself on uninstall, and
 * out/uninstall.js clears the copies belonging to other profiles and to
 * individual workspaces, which VS Code leaves behind.
 */
const STORE_FILE = "storage.json";

class JsonStore {

    private file: string;
    private data: { [key: string]: any } = {};

    /**
     * @param dir storage directory, or undefined for a store with nowhere to
     *            live -- no workspace is open. It then holds values for this
     *            session only rather than throwing on every write.
     */
    public init(dir: string | undefined) {
        this.file = undefined;
        this.data = {};
        if (!dir) { return; }
        try {
            // The directory is created on first write, not here: an install
            // where nothing was ever saved should leave nothing on disk.
            const file = join(dir, STORE_FILE);
            if (existsSync(file)) {
                this.data = JSON.parse(readFileSync(file, "utf8")) || {};
            }
            this.file = file;
        } catch (err) {
            // Unreadable or corrupt store: start empty rather than refuse to
            // activate. Losing saved connections is recoverable, a dead
            // extension is not.
            console.error("database client: cannot open storage", err);
            this.data = {};
        }
    }

    public keys(): string[] {
        return Object.keys(this.data);
    }

    public get<T>(key: string, defaultValue?: T): T {
        const value = this.data[key];
        return value === undefined ? defaultValue : value;
    }

    public update(key: string, value: any): Thenable<void> {
        if (value === undefined) {
            delete this.data[key];
        } else {
            this.data[key] = value;
        }
        try {
            this.flush();
        } catch (err) {
            return Promise.reject(err);
        }
        return Promise.resolve();
    }

    /** Drop every stored value and the file holding them. */
    public clear() {
        this.data = {};
        if (!this.file) { return; }
        try {
            if (existsSync(this.file)) { unlinkSync(this.file); }
        } catch (err) {
            console.error("database client: cannot clear storage", err);
        }
    }

    private flush() {
        if (!this.file) { return; }
        mkdirSync(dirname(this.file), { recursive: true });
        // Write beside the target and move it into place, so an interrupted
        // write cannot leave a half-serialised store that fails to parse and
        // takes every saved connection with it.
        const temp = `${this.file}.tmp`;
        writeFileSync(temp, JSON.stringify(this.data), { encoding: "utf8" });
        renameSync(temp, this.file);
    }

}

const globalStore = new JsonStore();
const workspaceStore = new JsonStore();

/**
 * Memento-shaped view of a store. Node.indent() persists through a Memento it
 * is handed, so it has to write to the same place the tree reads from.
 */
function asMemento(store: JsonStore): vscode.Memento {
    return {
        keys: () => store.keys(),
        get: <T>(key: string, defaultValue?: T) => store.get(key, defaultValue),
        update: (key: string, value: any) => store.update(key, value),
    } as vscode.Memento;
}

export const globalMemento = asMemento(globalStore);
export const workspaceMemento = asMemento(workspaceStore);

/** Keys written before connections moved out of globalState. */
const LEGACY_KEYS = [
    "mysql.connections", "redis.connections",
    "mysql.database.cache.collapseState", "redis.cache.collapseState",
    "sql.history",
];

/**
 * Connections saved by an earlier build live in VS Code's own state database.
 * Move them into the file store and clear the originals, so nothing is lost
 * and nothing is left behind for an uninstall to miss.
 */
function migrate(from: vscode.Memento, store: JsonStore) {
    let names = LEGACY_KEYS.slice();
    try {
        if (typeof (from as any).keys === "function") {
            names = Array.from(new Set(names.concat((from as any).keys())));
        }
    } catch (err) {
        // keys() only exists from VS Code 1.69; the known list still applies
    }
    for (const name of names) {
        let value: any;
        try {
            value = from.get(name);
        } catch (err) {
            continue;
        }
        if (value === undefined) { continue; }
        if (store.get(name) === undefined) {
            store.update(name, value);
        }
        Promise.resolve(from.update(name, undefined)).then(undefined, () => { });
    }
}

/**
 * Must run before anything reads a connection, so it is the first thing
 * activate() does.
 */
export function initState(context: vscode.ExtensionContext) {
    globalStore.init(context.globalStorageUri ? context.globalStorageUri.fsPath : context.globalStoragePath);
    // storageUri is undefined when no folder is open, and workspace-scoped
    // connections have no workspace to belong to in that case.
    workspaceStore.init(context.storageUri ? context.storageUri.fsPath : undefined);
    migrate(context.globalState, globalStore);
    migrate(context.workspaceState, workspaceStore);
}

/** Forget every connection, history entry and cached tree state. */
export function clearState() {
    globalStore.clear();
    workspaceStore.clear();
}

export class GlobalState {
    public static update(key: string, value: any): Thenable<void> {
        return globalStore.update(getKey(key), value);
    }

    public static get<T>(key: string, defaultValue?: T): T {
        return globalStore.get(getKey(key), defaultValue);
    }
}

export class WorkState {

    public static update(key: string, value: any): Thenable<void> {
        return workspaceStore.update(getKey(key), value);
    }

    public static get<T>(key: string, defaultValue?: T): T {
        return workspaceStore.get(getKey(key), defaultValue);
    }

}

export function getKey(key: string): string {

    if (vscode.env.remoteName == "ssh-remote" && key.indexOf("ssh-remote") == -1) {
        return key + "ssh-remote";
    }

    return key;
}
