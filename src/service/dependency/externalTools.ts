import * as vscode from "vscode";
import { Global } from "@/common/global";
import { Console } from "@/common/Console";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { platform } from "os";
var commandExistsSync = require('command-exists').sync;

/**
 * External command line tools this extension can use.
 * Nothing here is ever downloaded: the user installs the tool themselves,
 * either on PATH or into the folder set by 'database-client-jenishbh.binaryPath'.
 */
export interface ExternalTool {
    command: string;
    purpose: string;
    /** true when a feature cannot work at all without it. */
    required?: boolean;
    /** what happens when it is absent, shown instead of a bare "missing". */
    fallback?: string;
}

/**
 * Only `java` is genuinely required, and only for JDBC. Everything else either
 * has a fallback or gates a single optional action, so the check reports them
 * as optional rather than implying the extension is broken.
 */
export const EXTERNAL_TOOLS: ExternalTool[] = [
    {
        command: 'java', required: true,
        purpose: 'JDBC connections (Oracle, Db2, ClickHouse, Trino and ~20 more). The driver jars ship with the extension; the JVM does not.',
    },
    {
        command: 'sqlite3',
        purpose: 'SQLite connections.',
        fallback: 'A sqlite3 binary ships with the extension, so this is only used if you prefer your own.',
    },
    {
        command: 'mysqldump',
        purpose: 'MySQL backup and export.',
        fallback: 'A pure JavaScript dump runs instead, so backups still work.',
    },
    { command: 'mysql', purpose: 'The Open Terminal action for MySQL.', fallback: 'Only that action is unavailable; connections are unaffected.' },
    { command: 'psql', purpose: 'The Open Terminal action for PostgreSQL.', fallback: 'Only that action is unavailable; connections are unaffected.' },
    { command: 'mongo', purpose: 'The Open Terminal action for MongoDB.', fallback: 'Only that action is unavailable; connections are unaffected.' },
    {
        command: 'redis-cli',
        purpose: 'The Open Terminal action for Redis.',
        fallback: 'A built in terminal is used instead.',
    },
    { command: 'mongoimport', purpose: 'MongoDB import.', fallback: 'Only the import action is unavailable.' },
    { command: 'ssh', purpose: 'SSH SOCKS proxy tunnel.', fallback: 'Only the SOCKS proxy action is unavailable; SSH connections and tunnels are unaffected.' },
];

export class ExternalTools {

    /** Folder the user drops binaries into, from vscode settings. */
    public static getBinaryPath(): string {
        return Global.getConfig<string>('binaryPath', '') || '';
    }

    /**
     * Resolve a command to something spawnable.
     * Looks in the configured folder first so a user supplied binary always
     * wins over whatever happens to be on PATH, then falls back to PATH.
     * Returns null when the tool is not available.
     */
    public static resolve(command: string): string {
        const dir = this.getBinaryPath();
        if (dir) {
            for (const candidate of this.candidates(command)) {
                const full = join(dir, candidate);
                if (existsSync(full)) {
                    return full;
                }
            }
        }
        if (commandExistsSync(command)) {
            return command;
        }
        return null;
    }

    /** True when the tool can be run. */
    public static exists(command: string): boolean {
        return this.resolve(command) != null;
    }

    /**
     * Resolve or tell the user what to do about it.
     * Throws so callers stop before spawning a missing binary.
     */
    public static require(command: string): string {
        const resolved = this.resolve(command);
        if (resolved == null) {
            const dir = this.getBinaryPath();
            const errText = dir
                ? `Command '${command}' not found on PATH or in ${dir}`
                : `Command '${command}' not found on PATH. Set 'database-client-jenishbh.binaryPath' to a folder containing it.`;
            vscode.window.showErrorMessage(errText, 'Check External Tools').then(choice => {
                if (choice) { vscode.commands.executeCommand('jenishbh.dependency.check'); }
            });
            throw new Error(errText);
        }
        return resolved;
    }

    /** Driver jars the user placed in the binary folder. Nothing is downloaded. */
    public static findJars(): string[] {
        const dir = this.getBinaryPath();
        if (!dir || !existsSync(dir)) return [];
        try {
            return readdirSync(dir).filter(f => f.toLowerCase().endsWith(".jar"));
        } catch (err) {
            return [];
        }
    }

    private static candidates(command: string): string[] {
        return platform() == 'win32'
            ? [`${command}.exe`, `${command}.cmd`, `${command}.bat`, command]
            : [command];
    }

    /** Report which external tools are present. Downloads nothing. */
    public static async check(): Promise<void> {
        const dir = this.getBinaryPath();
        const items: vscode.QuickPickItem[] = EXTERNAL_TOOLS.map(tool => {
            const resolved = this.resolve(tool.command);
            const tag = resolved ? '$(check)' : (tool.required ? '$(error)' : '$(circle-outline)');
            return {
                label: `${tag} ${tool.command}${tool.required ? '  (required)' : '  (optional)'}`,
                description: resolved ? resolved : (tool.required ? 'not found - JDBC will not work' : 'not installed'),
                detail: resolved ? tool.purpose : [tool.purpose, tool.fallback].filter(Boolean).join('  '),
            };
        });

        Console.ling();
        Console.log(`External tool check. Binary folder: ${dir || '(not set)'}`);
        for (const tool of EXTERNAL_TOOLS) {
            const resolved = this.resolve(tool.command);
            const state = resolved ? 'OK      ' : (tool.required ? 'REQUIRED' : 'optional');
            Console.log(`  ${state} ${tool.command}${resolved ? ` -> ${resolved}` : ''}`);
            if (!resolved && tool.fallback) Console.log(`           ${tool.fallback}`);
        }

        const jars = this.findJars();
        Console.log(`  JDBC driver jars: ${jars.length ? jars.join(", ") : "(none)"}`);
        for (const jar of jars) {
            items.push({ label: `$(check) ${jar}`, description: "JDBC driver jar", detail: "Usable by a JDBC connection" });
        }

        // only a missing REQUIRED tool is a problem worth warning about
        const missingRequired = EXTERNAL_TOOLS.filter(t => t.required && !this.exists(t.command));
        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: missingRequired.length
                ? `Missing required: ${missingRequired.map(t => t.command).join(', ')}. Everything else is optional.`
                : 'All required tools found. Optional ones only gate individual actions.',
            matchOnDetail: true,
        });
        if (picked) {
            vscode.commands.executeCommand('workbench.action.openSettings', 'database-client-jenishbh.binaryPath');
        }
    }

}
