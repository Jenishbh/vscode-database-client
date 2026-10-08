# Database Client — Install

An offline-only VS Code database client. Nothing it does phones home, and it
ships with no connections configured.

## Install — double-click `INSTALL.bat`

That's it. It finds VS Code, installs the extension, and tells you what to do next.

Restart VS Code afterwards and look for **Database** in the activity bar.

### Use `INSTALL.bat`, not the `.vsix`

Windows does not install a `.vsix` by double-clicking it — the file gets handed to
whichever installer owns that extension on your PC, and that is not VS Code's
extension manager. `INSTALL.bat` calls the VS Code CLI directly, which does.

Or run it yourself:

```
code --install-extension vscode-database-client-1.5.0.vsix
```

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
`database-client.binaryPath` at it in VS Code settings. A binary in that
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

Double-click **`UNINSTALL.bat`**. It removes the extension and every saved
connection.

Uninstalling from **Extensions → Database Client → Uninstall** also clears saved
connections. `code --uninstall-extension` on its own does not: that route never
runs an extension's uninstall step, so it leaves them on disk. `UNINSTALL.bat`
covers both.

To clear saved connections without uninstalling:
`Ctrl+Shift+P` -> **Database Client: Delete All Saved Connections**.

## Your connections stay on this machine

Connections live in one file inside VS Code's own extension storage folder, and
nothing is sent anywhere. Removing the extension removes the file.

## Licence

MIT. A fork of [cweijan/vscode-database-client](https://github.com/cweijan/vscode-database-client)
at v3.9.8, the last openly licensed release. The original copyright is retained in `LICENSE`.
