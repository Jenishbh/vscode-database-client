# Database Client (jenishbh fork)

An offline-only fork of [cweijan/vscode-database-client](https://github.com/cweijan/vscode-database-client),
forked from the MIT-licensed source at version **3.9.8**.

Supports MySQL, MariaDB, PostgreSQL, SQLite, MongoDB, Redis, Microsoft SQL Server,
ElasticSearch, and SSH/FTP browsing.

## Credit

The original extension is by **Weijan Chen** and is MIT licensed. This fork keeps that
license and copyright notice intact; see [LICENSE](https://github.com/jenishbh/vscode-database-client/blob/HEAD/LICENSE). All modifications are marked
below.

Note that the author's current *published* extension (`cweijan.vscode-database-client2`,
version 9.x) is **not** this codebase. That build is closed-source under a proprietary
licence that forbids derivative works. This fork is based only on the MIT-licensed 3.9.8
source, which is the last openly licensed version.

## What this fork changes

### No data leaves your machine

The MIT 3.9.8 source contained no telemetry, and this fork adds none. Specifically, there is:

- no usage or crash telemetry,
- no account, licence, or "premium" server,
- no cloud sync of connection settings,
- no runtime download of binaries or code.

The only network connections the extension makes are to the database and SSH/FTP servers
**you** configure.

### External tools are never downloaded

Some features shell out to command line tools. This fork never downloads them. You install
them yourself, then either put them on your `PATH` or drop them in one folder and point the
extension at it:

1. Set **`database-client.binaryPath`** to a folder of your choice.
2. Place the executables you need in that folder.
3. Run **`Database Client: Check External Tools`** from the Command Palette to verify.

The check lists every tool, whether it was found, and the resolved path. A binary in your
configured folder takes priority over one on `PATH`. If a feature needs a tool that is
missing, the extension tells you which one and stops rather than proceeding.

| Tool | Needed for |
|---|---|
| `sqlite3` | SQLite connections (a fallback binary ships with the extension) |
| `mysql` | MySQL terminal |
| `mysqldump` | MySQL backup and export |
| `psql` | PostgreSQL terminal |
| `pg_dump` | PostgreSQL backup and export |
| `mongo` | MongoDB terminal |
| `mongoimport` | MongoDB import |
| `redis-cli` | Redis terminal |
| `ssh` | SSH SOCKS proxy tunnel |

### Security fixes

Vulnerable runtime dependencies were upgraded:

| Package | Was | Now | Fixed |
|---|---|---|---|
| `mysql2` | ^2.2.5 | ^3.11.5 | RCE (CVSS 9.8), code injection, prototype pollution |
| `ssh2` | 0.5.4 | ^1.16.0 | OS command injection (CVSS 7.5) |
| `axios` | ^0.21.1 | ^1.13.1 | Credential leakage and data-exfiltration gadgets |

After these upgrades no critical or high severity advisory remains in the runtime
dependency tree. The advisories that remain are in the build toolchain (webpack and
friends) and are not shipped to users.

Build tooling was also updated: TypeScript 3.9 to 5.x, and `skipLibCheck` enabled so
dependency type definitions do not block a clean type check.

### Other changes

- Publisher, extension ID, view IDs, and command categories renamed from `cweijan` to `jenishbh`.
- `pad()` in `historyRecorder.ts` declared a `number` return type but built a string; annotation corrected.
- `cpu-features` (an optional native dependency of `ssh2`) marked external in the esbuild config.

## Building

```bash
npm install
npm rebuild esbuild        # fetches the esbuild binary
node build.js              # extension backend  -> out/extension.js
npx webpack --mode=production   # webview frontend -> out/webview/
npx @vscode/vsce package --allow-star-activation
```

`NODE_OPTIONS=--openssl-legacy-provider` is required for the webpack step on Node 17+.

## Licence

MIT, unchanged from upstream. See [LICENSE](https://github.com/jenishbh/vscode-database-client/blob/HEAD/LICENSE).
