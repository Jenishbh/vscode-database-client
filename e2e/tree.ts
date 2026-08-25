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

const store: any = {
  [CacheKey.DATBASE_CONECTIONS]: config.database.global,
  [CacheKey.NOSQL_CONNECTION]: config.nosql.global,
};

const memento = {
  get: (k: string, d?: any) => (store[k] !== undefined ? store[k] : d),
  update: (k: string, v: any) => { store[k] = v; return Promise.resolve(); },
  setKeysForSync: () => { },
};

const context: any = {
  subscriptions: [],
  extensionPath: process.env.EXT_PATH,
  globalStoragePath: path.join(process.env.EXT_PATH, "_gs"),
  globalState: memento,
  workspaceState: { get: (k: string, d?: any) => d, update: () => Promise.resolve() },
  extension: { id: "jenishbh.vscode-database-client", packageJSON: { version: "0" } },
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
    if (/no files|no data|empty/i.test(label(bad))) return " > (empty)";
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
