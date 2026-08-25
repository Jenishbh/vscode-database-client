const fs = require("fs"), path = require("path");

// Command ids registered in code but never declared in package.json, so the
// first rename pass missed them. They collide with the other extension.
const CMDS = [
  "jenishbh.codeLens.run", "jenishbh.connection.open", "jenishbh.elastic.document",
  "jenishbh.elastic.execute", "jenishbh.elastic.lint", "jenishbh.history.record",
  "jenishbh.history.view", "jenishbh.query.open", "jenishbh.show.esIndex",
  "jenishbh.show.function", "jenishbh.show.procedure", "jenishbh.show.trigger",
  "jenishbh.ssh.file.open", "jenishbh.table.find", "jenishbh.user.sql",
];
// These are globalState keys, not commands. They are scoped per extension so
// they cannot collide, and renaming them would orphan saved connections.
const KEEP = ["mysql.connections", "mysql.database.cache.collapseState"];

CMDS.sort((a, b) => b.length - a.length);
const NEW = id => "jenishbh." + id.slice("mysql.".length);

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "out", ".git", "e2e", "jdbc"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|js|vue|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

let touched = 0, total = 0;
for (const f of walk(".", [])) {
  let s = fs.readFileSync(f, "utf8");
  const before = s;
  for (const id of CMDS) {
    if (!s.includes(id)) continue;
    const parts = s.split(id);
    total += parts.length - 1;
    s = parts.join(NEW(id));
  }
  if (s !== before) { fs.writeFileSync(f, s); touched++; }
}
console.log("renamed:", CMDS.length, "ids |", total, "occurrences |", touched, "files");

// verify: only the two storage keys should remain
const left = new Set();
for (const f of walk(".", [])) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.match(/mysql\.[A-Za-z0-9_.]+/g) || []) left.add(m);
}
const unexpected = [...left].filter(x => !KEEP.includes(x) && x !== "mysql.tmLanguage.json");
console.log("remaining mysql.* tokens:", [...left].join(", "));
console.log("unexpected:", unexpected.length ? unexpected.join(", ") : "none");
if (unexpected.length) process.exit(1);
