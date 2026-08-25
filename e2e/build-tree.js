const { build } = require("esbuild");
const path = require("path");
build({
  entryPoints: ["./e2e/tree.ts"],
  outfile: "e2e/out/tree.js",
  bundle: true, platform: "node", format: "cjs",
  logLevel: "error", sourcemap: false,
  external: ["pg-native", "cardinal", "aws4", "mongodb-client-encryption", "cpu-features"],
  plugins: [{
    name: "vscode-stub",
    setup(b) { b.onResolve({ filter: /^vscode$/ }, () => ({ path: path.resolve(__dirname, "vscode-stub.js") })); },
  }],
}).catch(() => process.exit(1));
