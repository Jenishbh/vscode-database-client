import * as vscode from "vscode";
import { Global } from "@/common/global";
import { Console } from "@/common/Console";
import { existsSync } from "fs";
import { join } from "path";
import { platform } from "os";
var commandExistsSync = require('command-exists').sync;

/**
 * External command line tools this extension can use.
 * Nothing here is ever downloaded: the user installs the tool themselves,
 * either on PATH or into the folder set by 'database-client.binaryPath'.
 */
export const EXTERNAL_TOOLS: { command: string, purpose: string }[] = [
    { command: 'sqlite3', purpose: 'SQLite connections (a fallback binary ships with the extension)' },
    { command: 'mysql', purpose: 'Open a MySQL terminal' },
    { command: 'mysqldump', purpose: 'MySQL backup and export' },
    { command: 'psql', purpose: 'Open a PostgreSQL terminal' },
    { command: 'pg_dump', purpose: 'PostgreSQL backup and export' },
    { command: 'mongo', purpose: 'Open a MongoDB terminal' },
    { command: 'mongoimport', purpose: 'MongoDB import' },
    { command: 'redis-cli', purpose: 'Open a Redis terminal' },
    { command: 'ssh', purpose: 'SSH SOCKS proxy tunnel' },
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
                : `Command '${command}' not found on PATH. Set 'database-client.binaryPath' to a folder containing it.`;
            vscode.window.showErrorMessage(errText, 'Check External Tools').then(choice => {
                if (choice) { vscode.commands.executeCommand('mysql.dependency.check'); }
            });
            throw new Error(errText);
        }
        return resolved;
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
            return {
                label: `${resolved ? '$(check)' : '$(x)'} ${tool.command}`,
                description: resolved ? resolved : 'not found',
                detail: tool.purpose,
            };
        });

        Console.ling();
        Console.log(`External tool check. Binary folder: ${dir || '(not set)'}`);
        for (const tool of EXTERNAL_TOOLS) {
            const resolved = this.resolve(tool.command);
            Console.log(`  ${resolved ? 'OK     ' : 'MISSING'} ${tool.command} ${resolved ? `-> ${resolved}` : ''}`);
        }

        const missing = EXTERNAL_TOOLS.filter(t => !this.exists(t.command)).length;
        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: missing == 0
                ? 'All external tools found'
                : `${missing} tool(s) missing. Install them yourself, then place them in the binary folder.`,
            matchOnDetail: true,
        });
        if (picked) {
            vscode.commands.executeCommand('workbench.action.openSettings', 'database-client.binaryPath');
        }
    }

}
