# Database Client (jenishbh) — Install

An offline-only VS Code database client. Nothing it does phones home.

## Install — double-click `INSTALL.bat`

That's it. It finds VS Code, installs the extension, and tells you what to do next.

Restart VS Code afterwards and look for **DB (jenishbh)** in the activity bar.

### Use `INSTALL.bat`, not the `.vsix`

Windows does not install a `.vsix` by double-clicking it — the file gets handed to
whichever installer owns that extension on your PC, and that is not VS Code's
extension manager. `INSTALL.bat` calls the VS Code CLI directly, which does.

Or run it yourself:

```
code --install-extension vscode-database-client-1.5.0.vsix
```

## Load the sample connections (optional)

`sample-connections.json` holds 20 example entries covering every connector: MySQL,
MariaDB, Percona, PostgreSQL, TimescaleDB, SQL Server, Oracle, ClickHouse, SQLite,
CockroachDB, Trino, MongoDB, Redis, ElasticSearch, SSH/SFTP, FTP and S3/MinIO.

`Ctrl+Shift+P` → **Database Client: Import Connections** → pick that file.

They point at localhost and are examples of the file format, not working credentials.
Edit hosts, ports and passwords to match your own servers.

## What works with no extra downloads

Every database driver is compiled into the extension. These connect out of the box:

| | |
|---|---|
| MySQL · MariaDB · Percona | PostgreSQL · CockroachDB · TimescaleDB |
| SQL Server | Oracle |
| ClickHouse | MongoDB |
| Redis | ElasticSearch |
| SQLite *(binary included)* | S3 / MinIO |
| SSH / SFTP | FTP |

Roughly twenty more engines work through the bundled JDBC bridge — Db2, Trino,
Snowflake, BigQuery, Databricks, Hive, Redshift, Cassandra, H2 and others. All ten
driver jars ship inside the extension.

## What needs Java

JDBC connections only.

You need a **JDK 11 or newer — a JRE is not enough.** The bridge runs as
`java -cp <drivers> JdbcBridge.java`, Java's single-file source mode (JEP 330),
which uses the JDK's built-in compiler. A JRE has no compiler and will fail.

JDK 21 is recommended. Put `java` on your `PATH`, then run
`Ctrl+Shift+P` → **Database Client: Check External Tools** to confirm it was found.

## Optional command line tools

All optional. Each gates one action; none are needed to connect, browse, query or edit.

| Tool | Gives you | Without it |
|---|---|---|
| `mysqldump` | faster, more faithful MySQL dumps | a pure JavaScript dump runs instead |
| `mysql` / `psql` / `mongo` | the **Open Terminal** action | only that action is unavailable |
| `redis-cli` | a native Redis terminal | a built-in terminal is used |
| `mongoimport` | MongoDB import | only that action is unavailable |
| `ssh` | SOCKS proxy tunnelling | SSH connections and tunnels still work |

Put them on your `PATH`, or drop them in one folder and point
`database-client-jenishbh.binaryPath` at it in VS Code settings. A binary in that
folder takes priority over one on `PATH`.

**Database Client: Check External Tools** lists every tool, whether it was found, and
where it resolved to.

## Privacy

No telemetry, no account, no licence server, no cloud sync, and nothing is downloaded
at runtime. The only network connections are to the database and SSH/FTP servers you
configure yourself.

A tracking pixel that ships inside a third-party charting library is neutralised at
build time, and the webviews carry a Content-Security-Policy with `connect-src 'self'`.

## Uninstall

VS Code → Extensions → find **Database Client (jenishbh)** → Uninstall.

Or: `code --uninstall-extension jenishbh.vscode-database-client`

## Licence

MIT. A fork of [cweijan/vscode-database-client](https://github.com/cweijan/vscode-database-client)
at v3.9.8, the last openly licensed release. The original copyright is retained in `LICENSE`.
