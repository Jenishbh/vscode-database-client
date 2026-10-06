# Database Client (jenishbh) — Install

An offline-only VS Code database client. Nothing it does phones home.

## Install

1. Open **VS Code**
2. `Ctrl+Shift+P` → **Extensions: Install from VSIX...**
3. Pick `vscode-database-client-1.5.0.vsix` from this folder
4. Reload VS Code when prompted

Or from a terminal:

```
code --install-extension vscode-database-client-1.5.0.vsix
```

Then look for **DB (jenishbh)** and **NoSQL (jenishbh)** in the activity bar.

## Load the sample connections (optional)

`sample-connections.json` holds 20 example entries covering every connector: MySQL,
MariaDB, Percona, PostgreSQL, TimescaleDB, SQL Server, Oracle, ClickHouse, SQLite,
CockroachDB, Trino, MongoDB, Redis, ElasticSearch, SSH/SFTP, FTP and S3/MinIO.

They point at localhost and are examples of the file format, not working credentials.

`Ctrl+Shift+P` → **Database Client: Import Connections** → pick that file.

Edit hosts, ports and passwords to match your own servers.

## What works with no extra downloads

Every database driver is compiled into the extension. These connect out of the box:

| | |
|---|---|
| MySQL · MariaDB · Percona | PostgreSQL · CockroachDB · TimescaleDB |
| SQL Server | MongoDB |
| Redis | ElasticSearch |
| SQLite *(binary included)* | S3 / MinIO |
| SSH / SFTP | FTP |

## What needs Java

JDBC connections — **Oracle, Db2, ClickHouse, Trino, H2** and roughly twenty more.

The driver `.jar` files ship inside the extension. The Java runtime does not, because
we cannot redistribute a JVM.

You need a **JDK 11 or newer — a JRE is not enough.** The helper runs as
`java -cp <drivers> JdbcBridge.java`, which is Java's single-file source mode (JEP 330)
and uses the JDK's built-in compiler. A JRE has no compiler and will fail.

JDK 21 is recommended. Make sure `java` is on your `PATH`, then run
`Ctrl+Shift+P` → **Database Client: Check External Tools** to confirm it was found.

## Optional command line tools

Everything below is optional. Each one gates a single action; none of them are needed
to connect, browse, query or edit.

| Tool | Gives you | Without it |
|---|---|---|
| `mysqldump` | faster, more faithful MySQL dumps | a pure JavaScript dump runs instead |
| `mysql` / `psql` / `mongo` | the **Open Terminal** action | only that action is unavailable |
| `redis-cli` | a native Redis terminal | a built-in terminal is used |
| `mongoimport` | MongoDB import | only that action is unavailable |
| `ssh` | SOCKS proxy tunnelling | SSH connections and tunnels still work |

To use them, either put them on your `PATH`, or drop them in one folder and set
`database-client-jenishbh.binaryPath` to it in VS Code settings. A binary in that
folder takes priority over one on `PATH`.

**Database Client: Check External Tools** lists every tool, whether it was found, and
where it resolved to.

## Privacy

No telemetry, no account, no licence server, no cloud sync, and nothing is downloaded
at runtime. The only network connections are to the database and SSH/FTP servers you
configure yourself.

A tracking pixel found inside a third-party charting library is neutralised at build
time, and the webviews carry a Content-Security-Policy with `connect-src 'self'`.

## Licence

MIT. A fork of [cweijan/vscode-database-client](https://github.com/cweijan/vscode-database-client)
at v3.9.8, the last openly licensed release. The original copyright is retained in `LICENSE`.
