/**
 * Build gate for the things that only fail at runtime, in the VS Code host,
 * after packaging -- where they look like "the extension is broken" rather
 * than like a mistake in a manifest.
 *
 * It loads the built bundle against the test stub, runs activate(), and checks
 * the result against package.json:
 *
 *  - a command id registered twice makes registerCommand throw, which aborts
 *    activate() and leaves every command "not found"
 *  - a command declared in a menu but not in contributes.commands shows up as
 *    a blank menu entry
 *  - a command declared in contributes.commands but never registered shows up
 *    in the palette and fails when picked
 *  - a menu item in an "inline" group with no icon renders as nothing at all
 *  - a view or container id referenced from a different place than it is
 *    declared silently produces an empty panel
 *  - the uninstall hook must match the shape VS Code actually accepts, or
 *    uninstalling quietly leaves saved connections behind
 */
const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const contributes = manifest.contributes || {};

const problems = [];
const fail = (msg) => problems.push(msg);

// ---------------------------------------------------------------- 1. load
// Resolve 'vscode' to the stub, then run the real activate().
const STUB = path.join(ROOT, "e2e", "vscode-stub.js");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    if (request === "vscode") { return STUB; }
    return resolve.call(this, request, ...rest);
};

const vscode = require(STUB);
const registered = [];
const duplicates = [];
vscode.commands.registerCommand = (id) => {
    if (registered.indexOf(id) !== -1) { duplicates.push(id); }
    registered.push(id);
    return { dispose() {} };
};

const storage = path.join(require("os").tmpdir(), "dbclient-preflight");
const memento = () => ({
    get: (_k, d) => d,
    update: () => Promise.resolve(),
    keys: () => [],
    setKeysForSync: () => {},
});
const context = {
    subscriptions: [],
    extensionPath: ROOT,
    globalStoragePath: storage,
    globalStorageUri: { fsPath: storage },
    storageUri: undefined,
    logUri: { fsPath: storage },
    globalState: memento(),
    workspaceState: memento(),
    secrets: { get: () => Promise.resolve(undefined), store: () => Promise.resolve(), delete: () => Promise.resolve() },
    asAbsolutePath: (p) => path.join(ROOT, p),
    extension: { id: manifest.publisher + "." + manifest.name, packageJSON: manifest },
    extensionMode: 2,
    environmentVariableCollection: { replace() {}, append() {}, prepend() {}, clear() {} },
};

const bundle = path.join(ROOT, "out", "extension.js");
if (!fs.existsSync(bundle)) {
    console.error("preflight: out/extension.js missing -- run the build first");
    process.exit(1);
}

try {
    require(bundle).activate(context);
} catch (err) {
    console.error("preflight: activate() threw -- the extension would fail to start\n");
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
}

if (duplicates.length) {
    fail("command id registered more than once (activate() throws in VS Code): " + duplicates.join(", "));
}

// ------------------------------------------------- 2. manifest <-> runtime
const declared = (contributes.commands || []).map((c) => c.command);

const seen = new Set();
for (const id of declared) {
    if (seen.has(id)) { fail("duplicate entry in contributes.commands: " + id); }
    seen.add(id);
}

const referenced = new Set();
for (const [menu, items] of Object.entries(contributes.menus || {})) {
    for (const item of items) {
        if (item.command) { referenced.add(item.command); }
        if (item.submenu) { continue; }
        // An inline menu item with no icon occupies a slot and draws nothing.
        if (item.group && item.group.startsWith("inline")) {
            const command = (contributes.commands || []).find((c) => c.command === item.command);
            if (command && !command.icon) {
                fail("menu '" + menu + "' puts " + item.command + " in an inline group but the command has no icon, so it renders as empty space");
            }
        }
    }
}
for (const binding of contributes.keybindings || []) {
    if (binding.command) { referenced.add(binding.command); }
}

for (const id of referenced) {
    if (!seen.has(id)) { fail("menu or keybinding points at an undeclared command: " + id); }
}

// Commands handled by the webviews are invoked, never contributed, so only
// check the direction that produces a visible failure: a palette entry that
// resolves to nothing.
const registeredSet = new Set(registered);
for (const id of declared) {
    if (!registeredSet.has(id)) {
        fail("contributes.commands declares " + id + " but nothing registers it, so running it from the palette fails");
    }
}

// ------------------------------------------------------------- 3. view ids
const containers = [].concat(...Object.values(contributes.viewsContainers || {})).map((c) => c.id);
for (const container of Object.keys(contributes.views || {})) {
    if (containers.indexOf(container) === -1) {
        fail("contributes.views has an entry for '" + container + "' but no container declares that id, so the views never appear");
    }
}
const viewIds = [].concat(...Object.values(contributes.views || {})).map((v) => v.id);
for (const id of viewIds) {
    if (!/^[A-Za-z0-9_.-]+$/.test(id)) { fail("view id is not a plain identifier: " + id); }
}

// Menus gate on the view id by regex ("view =~ /dbclient.+?ql/"), so renaming a
// view can stop every menu matching without anything erroring -- the entries
// just stop appearing.
const viewPatterns = new Set();
for (const items of Object.values(contributes.menus || {})) {
    for (const item of items) {
        if (!item.when) { continue; }
        const matches = item.when.match(/view\s*=~\s*\/([^/]+)\//g) || [];
        for (const match of matches) {
            viewPatterns.add(match.replace(/^view\s*=~\s*\//, "").replace(/\/$/, ""));
        }
    }
}
for (const pattern of viewPatterns) {
    let re;
    try {
        re = new RegExp(pattern);
    } catch (err) {
        fail("menu 'when' holds an invalid view regex /" + pattern + "/");
        continue;
    }
    const hits = viewIds.filter((id) => re.test(id));
    if (!hits.length) {
        fail("no view id matches the menu regex /" + pattern + "/, so those menu entries never show (views are: " + viewIds.join(", ") + ")");
    }
}

// ---------------------------------------------------------- 4. branding
const BRANDS = ["jenishbh", "cweijan"];
const idStrings = declared.concat(containers, viewIds,
    Object.keys((contributes.configuration || {}).properties || {}),
    [manifest.publisher, manifest.name, manifest.displayName],
    [].concat(...Object.values(contributes.viewsContainers || {})).map((c) => c.title),
    [].concat(...Object.values(contributes.views || {})).map((v) => v.name));
for (const value of idStrings) {
    for (const brand of BRANDS) {
        if (typeof value === "string" && value.toLowerCase().includes(brand)) {
            fail("a personal name is still in an id or a visible title: " + JSON.stringify(value));
        }
    }
}

// ------------------------------------------------------ 5. uninstall hook
const hook = (manifest.scripts || {})["vscode:uninstall"];
if (!hook) {
    fail("no vscode:uninstall script, so uninstalling leaves saved connections on disk");
} else {
    // Mirrors ExtensionsLifecycle.parseScript: split on spaces, argv[0] must be
    // "node", argv[1] is resolved against the extension folder.
    const argv = hook.split(" ");
    if (argv.length < 2 || argv[0] !== "node" || !argv[1]) {
        fail("vscode:uninstall must read 'node <script>' or VS Code skips it: " + hook);
    } else {
        const target = path.join(ROOT, argv[1]);
        if (!fs.existsSync(target)) {
            fail("vscode:uninstall points at " + argv[1] + ", which the build does not produce");
        }
        const source = fs.readFileSync(path.join(ROOT, "build", "uninstall.js"), "utf8");
        const expected = manifest.publisher + "." + manifest.name;
        if (!source.includes('"' + expected + '"')) {
            fail("the fallback extension id in build/uninstall.js no longer matches " + expected);
        }
    }
}

// ------------------------------------------------------------------ report
if (problems.length) {
    console.error("\npreflight failed:\n");
    for (const problem of problems) { console.error("  - " + problem); }
    console.error("");
    process.exit(1);
}

console.log("preflight ok: " + registered.length + " commands registered, " +
    declared.length + " declared, " + viewIds.length + " views in " + containers.length + " containers");
