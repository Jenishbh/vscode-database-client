/**
 * Runs when the extension is uninstalled, via the "vscode:uninstall" script in
 * package.json. VS Code resolves that path against the extension folder, forks
 * it with plain node -- no vscode module available -- and kills it after five
 * seconds, so everything here is synchronous and bounded.
 *
 * Purpose: leave no saved connection behind. VS Code deletes
 * globalStorage/<extension-id> for the default profile on its own, but not the
 * same folder in other profiles, and not workspaceStorage/<hash>/<extension-id>
 * for any workspace the extension was used in. Those hold storage.json, which
 * is where connections (including passwords) live.
 *
 * Only folders whose name is exactly the extension id are removed.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const DEADLINE = Date.now() + 4000; // stay inside VS Code's 5s kill timer

// Fallback only. build/preflight.js fails the build if it stops matching
// package.json, so the literal cannot silently drift.
const EXTENSION_ID_FALLBACK = "dbclient.vscode-database-client";

/** This script sits at <extension>/out/uninstall.js, so the manifest is one level up. */
function extensionId() {
    try {
        const manifest = require(path.join(__dirname, "..", "package.json"));
        if (manifest.publisher && manifest.name) {
            return manifest.publisher + "." + manifest.name;
        }
    } catch (err) {
        // packaged without its manifest next to us; use the literal
    }
    return EXTENSION_ID_FALLBACK;
}

const EXTENSION_ID = extensionId();

/** Every "<user data>/User" directory a VS Code build might be using. */
function userDirs() {
    const home = os.homedir();
    const names = ["Code", "Code - Insiders", "VSCodium", "VSCodium - Insiders"];
    let roots;
    if (process.platform === "win32") {
        roots = [process.env.APPDATA || path.join(home, "AppData", "Roaming")];
    } else if (process.platform === "darwin") {
        roots = [path.join(home, "Library", "Application Support")];
    } else {
        roots = [process.env.XDG_CONFIG_HOME || path.join(home, ".config")];
    }
    const dirs = [];
    for (const root of roots) {
        for (const name of names) {
            dirs.push(path.join(root, name, "User"));
        }
    }

    // A portable install, or one started with --user-data-dir, keeps its data
    // somewhere the paths above do not cover. This script lives at
    // <extensions>/<id>-<version>/out/uninstall.js, so walk up and look for a
    // sibling "User" directory.
    if (process.env.VSCODE_PORTABLE) {
        dirs.push(path.join(process.env.VSCODE_PORTABLE, "user-data", "User"));
    }
    const extensionsDir = path.join(__dirname, "..", "..");
    for (const base of [path.join(extensionsDir, ".."), path.join(extensionsDir, "..", "..")]) {
        dirs.push(path.join(base, "User"));
        dirs.push(path.join(base, "user-data", "User"));
        dirs.push(path.join(base, "data", "user-data", "User"));
    }

    // de-duplicate, since several of these can resolve to the same place
    const seen = {};
    return dirs.filter(function (dir) {
        const key = path.resolve(dir).toLowerCase();
        if (seen[key]) { return false; }
        seen[key] = true;
        return true;
    });
}

function subdirs(dir) {
    try {
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => path.join(dir, e.name));
    } catch (err) {
        return [];
    }
}

/** Storage folders belonging to this extension, across profiles and workspaces. */
function targets() {
    const found = [];
    for (const user of userDirs()) {
        if (!fs.existsSync(user)) { continue; }

        // default profile, plus one globalStorage per named profile
        const globalRoots = [path.join(user, "globalStorage")];
        for (const profile of subdirs(path.join(user, "profiles"))) {
            globalRoots.push(path.join(profile, "globalStorage"));
        }
        for (const root of globalRoots) {
            found.push(path.join(root, EXTENSION_ID));
        }

        // one folder per workspace the extension stored anything for
        for (const workspace of subdirs(path.join(user, "workspaceStorage"))) {
            found.push(path.join(workspace, EXTENSION_ID));
        }
    }
    return found;
}

let removed = 0;
for (const target of targets()) {
    if (Date.now() > DEADLINE) {
        console.error("uninstall cleanup stopped early at " + target);
        break;
    }
    try {
        if (fs.existsSync(target)) {
            fs.rmSync(target, { recursive: true, force: true });
            removed++;
        }
    } catch (err) {
        // Keep going: one locked folder should not strand the rest.
        console.error("could not remove " + target + ": " + err.message);
    }
}

console.log("removed " + removed + " storage folder(s)");
