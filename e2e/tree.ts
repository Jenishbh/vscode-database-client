/**
 * Walks the real tree providers the same way the sidebar does:
 * getChildren() with no element gives the connection nodes, then each level
 * down. A failure surfaces as an InfoNode, which is what the user would see
 * in the tree, so that is what we assert on.
 */
import { activate } from "@/extension";
import { DbTreeDataProvider } from "@/provider/treeDataProvider";
import { CacheKey } from "@/common/constants";

process.on("uncaughtException", e => console.log("  [uncaught] " + (e && e.message)));
process.on("unhandledRejection", (e: any) => console.log("  [unhandled] " + (e && e.message)));

const fs = require("fs");
const path = require("path");

const config = JSON.parse(fs.readFileSync(process.env.CONN_JSON, "utf8"));

// Starts empty: connections are seeded after activate() through the store the
// extension really uses. Pre-filling this would only exercise the legacy
// migration path, not the tree.
const store: any = {};

const memento = {
  get: (k: string, d?: any) => (store[k] !== undefined ? store[k] : d),
  update: (k: string, v: any) => { store[k] = v; return Promise.resolve(); },
  setKeysForSync: () => { },
};

const storageDir = path.join(process.env.EXT_PATH, "_gs");
// Start from nothing, so this also proves a fresh install has no connections.
fs.rmSync(storageDir, { recursive: true, force: true });

const context: any = {
  subscriptions: [],
  extensionPath: process.env.EXT_PATH,
  globalStoragePath: storageDir,
  globalStorageUri: { fsPath: storageDir },
  storageUri: { fsPath: path.join(storageDir, "ws") },
  globalState: memento,
  workspaceState: { get: (k: string, d?: any) => d, update: () => Promise.resolve() },
  extension: { id: "dbclient.vscode-database-client", packageJSON: { version: "0" } },
};

require("@/common/global").Global.context = context;
require("@/common/filesManager").FileManager.init(context);

const isError = (n: any) => n && n.constructor && n.constructor.name === "InfoNode";
const label = (n: any) => String(n && (n.label !== undefined ? n.label : n.description) || "?");

type Row = { conn: string; ok: boolean; detail: string };
const rows: Row[] = [];

async function children(provider: DbTreeDataProvider, node?: any): Promise<any[]> {
  try {
    const t = new Promise<any[]>(res => setTimeout(() => res([{ __timeout: true }]), 25000));
    return await Promise.race([provider.getChildren(node), t]);
  } catch (e: any) {
    return [{ __err: e && e.message }];
  }
}

/** Descend up to `depth` levels, returning a compact path summary. */
async function descend(provider: DbTreeDataProvider, node: any, depth: number): Promise<string> {
  if (depth === 0) return "";
  const kids = await children(provider, node);
  if (!kids.length) return " > (empty)";
  const bad = kids.find(isError);
  if (bad) {
    // an informational "nothing here" node is normal, not a failure
    if (/no files|no data|empty|no table/i.test(label(bad))) return " > (empty)";
    return " > ERROR: " + label(bad);
  }
  if (kids[0] && kids[0].__timeout) return " > TIMEOUT";
  if (kids[0] && kids[0].__err) return " > THREW: " + kids[0].__err;
  const names = kids.slice(0, 4).map(label).join(", ");
  const more = kids.length > 4 ? ` +${kids.length - 4}` : "";
  const deeper = await descend(provider, kids[0], depth - 1);
  return ` > ${kids.length}: [${names}${more}]${deeper}`;
}

async function walk(key: string, treeName: string) {
  const provider = new DbTreeDataProvider(context, key);
  const conns = await children(provider);
  if (conns.length && (conns[0] as any).__err) {
    console.log(`\n########## ${treeName} — getConnectionNodes THREW ##########`);
    console.log("  " + (conns[0] as any).__err);
    rows.push({ conn: treeName, ok: false, detail: "getConnectionNodes threw: " + (conns[0] as any).__err });
    return;
  }
  console.log(`\n########## ${treeName} — ${conns.length} connections ##########`);
  for (const c of conns) {
    const name = label(c);
    process.stdout.write(`  ${name} ... `);
    if (isError(c)) {
      rows.push({ conn: name, ok: false, detail: "connection node is an error" });
      console.log("FAIL");
      continue;
    }
    const summary = await descend(provider, c, 3);
    const ok = !/ERROR|TIMEOUT|THREW/.test(summary);
    rows.push({ conn: name, ok, detail: summary.trim() || "(no children)" });
    console.log(ok ? "OK" : "FAIL");
    try { require("@/service/connectionManager").ConnectionManager.removeConnection(c.getConnectId()); } catch { }
  }
}

(async () => {
  await activate(context);

  // Connections live in a file store that activate() opens, not in
  // context.globalState, so seed through the accessor the extension itself
  // uses rather than through a stubbed memento.
  const { GlobalState } = require("@/common/state");
  if (Object.keys(GlobalState.get(CacheKey.DATBASE_CONECTIONS, {})).length !== 0) {
    throw new Error("a fresh store should hold no connections");
  }

  // Saving and listing go through different code: addConnection persists via
  // the Memento on the node, getConnectionNodes reads the store. When those
  // two pointed at different places a connection saved fine and never
  // appeared in the tree, which is what the user sees.
  {
    const { DbTreeDataProvider: Provider } = require("@/provider/treeDataProvider");
    const { NodeUtil } = require("@/model/nodeUtil");
    const { CommandKey } = require("@/model/interface/node");
    const probe = NodeUtil.of({
      name: "round-trip probe", dbType: "MySQL", global: true,
      host: "127.0.0.1", port: 13306, user: "root", password: "x",
    });
    const provider = new Provider(context, CacheKey.DATBASE_CONECTIONS);
    probe.initKey();
    await provider.addConnection(probe);
    const listed = await provider.getConnectionNodes();
    const found = listed.some((n: any) => n.name === "round-trip probe");
    if (!found) {
      throw new Error("addConnection saved a connection the tree cannot list (" +
        listed.length + " listed)");
    }
    await probe.indent({ command: CommandKey.delete, connectionKey: probe.connectionKey, refresh: false });
    const after = await provider.getConnectionNodes();
    if (after.some((n: any) => n.name === "round-trip probe")) {
      throw new Error("deleting a connection left it in the tree");
    }
    console.log("  save -> list round trip: OK");
  }
  await GlobalState.update(CacheKey.DATBASE_CONECTIONS, config.database.global);
  await GlobalState.update(CacheKey.NOSQL_CONNECTION, config.nosql.global);

  await walk(CacheKey.DATBASE_CONECTIONS, "Database tree");
  await walk(CacheKey.NOSQL_CONNECTION, "NoSQL tree");

  console.log("\n================ TREE EXPANSION ================");
  const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
  for (const r of rows) {
    console.log(pad(r.conn, 28) + pad(r.ok ? "OK" : "FAIL", 6) + r.detail.slice(0, 108));
  }
  const passed = rows.filter(r => r.ok).length;
  console.log("-".repeat(100));
  console.log(`${passed}/${rows.length} connections expand`);
  process.exit(passed === rows.length ? 0 : 1);
})();
