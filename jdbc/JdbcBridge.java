import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

/**
 * Line oriented JDBC bridge for the Database Client extension.
 *
 * One JSON request per line on stdin, one JSON response per line on stdout.
 * Nothing is downloaded and nothing is sent anywhere: the process only talks
 * to the JDBC url it is given, using the driver jars on its classpath.
 *
 * Run with:
 *   java -cp DRIVER_JARS JdbcBridge.java
 */
public class JdbcBridge {

    private static Connection conn;
    private static PrintStream out;

    public static void main(String[] args) throws Exception {
        out = new PrintStream(System.out, true, "UTF-8");
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        String line;
        while ((line = in.readLine()) != null) {
            if (line.isEmpty()) continue;
            Object id = null;
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> req = (Map<String, Object>) Json.parse(line);
                id = req.get("id");
                dispatch(id, req);
            } catch (Throwable t) {
                fail(id, t);
            }
        }
        closeQuietly();
    }

    private static void dispatch(Object id, Map<String, Object> req) throws Exception {
        String action = str(req.get("action"));
        if (action == null) {
            fail(id, new IllegalArgumentException("missing action"));
            return;
        }
        switch (action) {
            case "ping":
                ok(id, map("pong", Boolean.TRUE, "java", System.getProperty("java.version")));
                break;
            case "connect":
                connect(id, req);
                break;
            case "query":
                query(id, req);
                break;
            case "meta":
                meta(id);
                break;
            case "structure":
                structure(id, req);
                break;
            case "close":
                closeQuietly();
                ok(id, map());
                break;
            default:
                fail(id, new IllegalArgumentException("unknown action: " + action));
        }
    }

    private static void connect(Object id, Map<String, Object> req) throws Exception {
        String url = str(req.get("url"));
        String driver = str(req.get("driver"));
        // Load the driver explicitly. DriverManager service discovery does not
        // always see jars supplied to a source-file launch, and a driver loaded
        // by a different classloader is refused unless it is re-wrapped.
        if (driver != null && !driver.isEmpty()) {
            Class<?> c = Class.forName(driver);
            try {
                DriverManager.registerDriver(new DriverShim((Driver) c.getDeclaredConstructor().newInstance()));
            } catch (Exception ignored) {
                // already registered by its own static initialiser
            }
        }
        Properties props = new Properties();
        String user = str(req.get("user"));
        String password = str(req.get("password"));
        if (user != null) props.setProperty("user", user);
        if (password != null) props.setProperty("password", password);
        Object extra = req.get("properties");
        if (extra instanceof Map) {
            for (Map.Entry<?, ?> e : ((Map<?, ?>) extra).entrySet()) {
                if (e.getValue() != null) {
                    props.setProperty(String.valueOf(e.getKey()), String.valueOf(e.getValue()));
                }
            }
        }
        closeQuietly();
        conn = DriverManager.getConnection(url, props);
        DatabaseMetaData md = conn.getMetaData();
        ok(id, map("product", md.getDatabaseProductName(),
                   "version", md.getDatabaseProductVersion(),
                   "driver", md.getDriverName()));
    }

    private static void meta(Object id) throws Exception {
        requireConn();
        DatabaseMetaData md = conn.getMetaData();
        ok(id, map("product", md.getDatabaseProductName(),
                   "version", md.getDatabaseProductVersion(),
                   "driver", md.getDriverName(),
                   "catalog", safeCatalog(),
                   "schema", safeSchema()));
    }

    private static String safeCatalog() {
        try {
            return conn.getCatalog();
        } catch (Throwable t) {
            return null;
        }
    }

    private static String safeSchema() {
        try {
            return conn.getSchema();
        } catch (Throwable t) {
            return null;
        }
    }

    /**
     * Schema browsing via DatabaseMetaData rather than engine specific SQL, so
     * the tree works against any JDBC target without a per engine dialect.
     * Rows are shaped to match what the extension's dialects already return.
     */
    private static void structure(Object id, Map<String, Object> req) throws Exception {
        requireConn();
        String op = str(req.get("op"));
        String catalog = str(req.get("catalog"));
        String schema = str(req.get("schema"));
        String table = str(req.get("table"));
        DatabaseMetaData md = conn.getMetaData();
        List<Object> rows = new ArrayList<Object>();

        if ("catalogs".equals(op)) {
            // getCatalogs() is pathologically slow on some drivers (ClickHouse
            // takes ~30s while every other call is ~1s), so give it a budget
            // and degrade rather than hang the tree.
            List<Object> cats = withBudget(5, new java.util.concurrent.Callable<List<Object>>() {
                public List<Object> call() throws Exception {
                    List<Object> acc = new ArrayList<Object>();
                    ResultSet rs = conn.getMetaData().getCatalogs();
                    try {
                        while (rs.next()) acc.add(map("Database", rs.getString("TABLE_CAT")));
                    } finally {
                        rs.close();
                    }
                    return acc;
                }
            });
            if (cats != null && !cats.isEmpty()) {
                ok(id, map("rows", cats));
                return;
            }
            // engines without catalogs (Oracle, Trino) expose schemas instead
            structureSchemas(id, md);
            return;
        }

        if ("schemas".equals(op)) {
            structureSchemas(id, md);
            return;
        }

        if ("tables".equals(op) || "views".equals(op)) {
            String[] types = "views".equals(op) ? new String[] { "VIEW" } : new String[] { "TABLE" };
            ResultSet rs = md.getTables(blankToNull(catalog), blankToNull(schema), "%", types);
            try {
                while (rs.next()) {
                    String remark = rs.getString("REMARKS");
                    rows.add(map("name", rs.getString("TABLE_NAME"), "comment", remark == null ? "" : remark));
                }
            } finally {
                rs.close();
            }
            ok(id, map("rows", rows));
            return;
        }

        if ("columns".equals(op)) {
            java.util.Set<String> pks = new java.util.HashSet<String>();
            try {
                ResultSet pk = md.getPrimaryKeys(blankToNull(catalog), blankToNull(schema), table);
                try {
                    while (pk.next()) pks.add(pk.getString("COLUMN_NAME"));
                } finally {
                    pk.close();
                }
            } catch (Throwable ignored) {
                // some drivers refuse primary key lookups; columns still list fine
            }
            ResultSet rs = md.getColumns(blankToNull(catalog), blankToNull(schema), table, "%");
            try {
                while (rs.next()) {
                    String name = rs.getString("COLUMN_NAME");
                    String remark = rs.getString("REMARKS");
                    rows.add(map(
                        "name", name,
                        "type", rs.getString("TYPE_NAME"),
                        "simpleType", rs.getString("TYPE_NAME"),
                        "nullable", rs.getInt("NULLABLE") == DatabaseMetaData.columnNoNulls ? "NO" : "YES",
                        "maxLength", Integer.valueOf(rs.getInt("COLUMN_SIZE")),
                        "defaultValue", rs.getString("COLUMN_DEF"),
                        "comment", remark == null ? "" : remark,
                        "key", pks.contains(name) ? "PRIMARY KEY" : null));
                }
            } finally {
                rs.close();
            }
            ok(id, map("rows", rows));
            return;
        }

        fail(id, new IllegalArgumentException("unknown structure op: " + op));
    }

    private static void structureSchemas(Object id, DatabaseMetaData md) throws Exception {
        List<Object> rows = new ArrayList<Object>();
        ResultSet rs = md.getSchemas();
        try {
            while (rs.next()) {
                String cat = null;
                try {
                    cat = rs.getString("TABLE_CATALOG");
                } catch (Throwable ignored) {
                    // not every driver reports a catalog column
                }
                String sch = rs.getString("TABLE_SCHEM");
                rows.add(map("Database", cat == null ? sch : cat, "schema", sch));
            }
        } finally {
            rs.close();
        }
        // last resort: a driver that reports neither catalogs nor schemas still
        // has the database it is connected to, so show at least that
        if (rows.isEmpty()) {
            String cur = safeCatalog();
            if (cur == null || cur.isEmpty()) cur = safeSchema();
            if (cur != null && !cur.isEmpty()) rows.add(map("Database", cur));
        }
        ok(id, map("rows", rows));
    }

    private static String blankToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    /** Run a metadata call with a time budget; null means it did not finish. */
    private static <T> T withBudget(int seconds, java.util.concurrent.Callable<T> work) {
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "jdbc-meta");
            t.setDaemon(true);
            return t;
        });
        try {
            return pool.submit(work).get(seconds, java.util.concurrent.TimeUnit.SECONDS);
        } catch (Throwable t) {
            return null;
        } finally {
            pool.shutdownNow();
        }
    }

    private static void query(Object id, Map<String, Object> req) throws Exception {
        requireConn();
        String sql = str(req.get("sql"));
        Object limitRaw = req.get("maxRows");
        int maxRows = limitRaw instanceof Number ? ((Number) limitRaw).intValue() : 0;

        Statement st = conn.createStatement();
        try {
            if (maxRows > 0) st.setMaxRows(maxRows);
            boolean hasResult = st.execute(sql);
            if (!hasResult) {
                ok(id, map("affectedRows", Long.valueOf(st.getUpdateCount())));
                return;
            }
            ResultSet rs = st.getResultSet();
            try {
                ResultSetMetaData m = rs.getMetaData();
                int n = m.getColumnCount();
                List<Object> fields = new ArrayList<Object>();
                for (int c = 1; c <= n; c++) {
                    fields.add(map("name", m.getColumnLabel(c),
                                   "type", m.getColumnTypeName(c),
                                   "table", m.getTableName(c)));
                }
                List<Object> rows = new ArrayList<Object>();
                while (rs.next()) {
                    List<Object> row = new ArrayList<Object>(n);
                    for (int c = 1; c <= n; c++) row.add(cell(rs, c));
                    rows.add(row);
                }
                ok(id, map("fields", fields, "rows", rows));
            } finally {
                rs.close();
            }
        } finally {
            st.close();
        }
    }

    /** Render a cell as a JSON safe value; unknown types fall back to toString. */
    private static Object cell(ResultSet rs, int c) throws SQLException {
        Object v = rs.getObject(c);
        if (v == null) return null;
        if (v instanceof Number || v instanceof Boolean) return v;
        if (v instanceof byte[]) return "0x" + hex((byte[]) v);
        return v.toString();
    }

    private static String hex(byte[] b) {
        StringBuilder s = new StringBuilder(b.length * 2);
        for (int i = 0; i < b.length; i++) s.append(String.format("%02x", Byte.valueOf(b[i])));
        return s.toString();
    }

    private static void requireConn() throws SQLException {
        if (conn == null || conn.isClosed()) throw new SQLException("not connected");
    }

    private static void closeQuietly() {
        if (conn != null) {
            try {
                conn.close();
            } catch (Throwable ignored) {
                // closing a already broken connection is not interesting
            }
            conn = null;
        }
    }

    // ---------- response helpers ----------

    private static void ok(Object id, Map<String, Object> body) {
        Map<String, Object> r = new LinkedHashMap<String, Object>();
        r.put("id", id);
        r.put("ok", Boolean.TRUE);
        r.putAll(body);
        emit(r);
    }

    private static void fail(Object id, Throwable t) {
        Map<String, Object> r = new LinkedHashMap<String, Object>();
        r.put("id", id);
        r.put("ok", Boolean.FALSE);
        String msg = t.getMessage();
        r.put("error", msg == null || msg.isEmpty() ? t.getClass().getName() : msg);
        emit(r);
    }

    private static void emit(Map<String, Object> r) {
        StringBuilder b = new StringBuilder();
        Json.write(b, r);
        out.println(b.toString());
    }

    private static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
        return m;
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    /** DriverManager refuses drivers loaded by a foreign classloader; this re-wraps one. */
    private static final class DriverShim implements Driver {
        private final Driver d;

        DriverShim(Driver d) {
            this.d = d;
        }

        public Connection connect(String u, Properties p) throws SQLException {
            return d.connect(u, p);
        }

        public boolean acceptsURL(String u) throws SQLException {
            return d.acceptsURL(u);
        }

        public java.sql.DriverPropertyInfo[] getPropertyInfo(String u, Properties p) throws SQLException {
            return d.getPropertyInfo(u, p);
        }

        public int getMajorVersion() {
            return d.getMajorVersion();
        }

        public int getMinorVersion() {
            return d.getMinorVersion();
        }

        public boolean jdbcCompliant() {
            return d.jdbcCompliant();
        }

        public java.util.logging.Logger getParentLogger() throws java.sql.SQLFeatureNotSupportedException {
            return d.getParentLogger();
        }
    }

    /** Minimal JSON reader/writer so the bridge needs no third party jars. */
    private static final class Json {

        // ---------- parsing ----------

        private final String s;
        private int i;

        private Json(String s) {
            this.s = s;
        }

        static Object parse(String text) {
            Json p = new Json(text);
            p.ws();
            Object v = p.value();
            p.ws();
            return v;
        }

        private void ws() {
            while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++;
        }

        private Object value() {
            char c = s.charAt(i);
            switch (c) {
                case '{': return object();
                case '[': return array();
                case '"': return string();
                case 't': i += 4; return Boolean.TRUE;
                case 'f': i += 5; return Boolean.FALSE;
                case 'n': i += 4; return null;
                default:  return number();
            }
        }

        private Map<String, Object> object() {
            Map<String, Object> m = new LinkedHashMap<String, Object>();
            i++;
            ws();
            if (s.charAt(i) == '}') {
                i++;
                return m;
            }
            while (true) {
                ws();
                String k = string();
                ws();
                i++; // ':'
                ws();
                m.put(k, value());
                ws();
                char c = s.charAt(i++);
                if (c == '}') return m;
            }
        }

        private List<Object> array() {
            List<Object> l = new ArrayList<Object>();
            i++;
            ws();
            if (s.charAt(i) == ']') {
                i++;
                return l;
            }
            while (true) {
                ws();
                l.add(value());
                ws();
                char c = s.charAt(i++);
                if (c == ']') return l;
            }
        }

        private String string() {
            StringBuilder b = new StringBuilder();
            i++; // opening quote
            while (true) {
                char c = s.charAt(i++);
                if (c == '"') return b.toString();
                if (c != BACKSLASH) {
                    b.append(c);
                    continue;
                }
                char e = s.charAt(i++);
                switch (e) {
                    case 'n': b.append('\n'); break;
                    case 't': b.append('\t'); break;
                    case 'r': b.append('\r'); break;
                    case 'b': b.append('\b'); break;
                    case 'f': b.append('\f'); break;
                    case 'u':
                        b.append((char) Integer.parseInt(s.substring(i, i + 4), 16));
                        i += 4;
                        break;
                    default:
                        b.append(e);
                }
            }
        }

        private Object number() {
            int start = i;
            while (i < s.length() && "-+.eE0123456789".indexOf(s.charAt(i)) >= 0) i++;
            String n = s.substring(start, i);
            if (n.indexOf('.') >= 0 || n.indexOf('e') >= 0 || n.indexOf('E') >= 0) {
                return Double.valueOf(n);
            }
            return Long.valueOf(n);
        }

        // ---------- writing ----------

        private static final char BACKSLASH = (char) 92;
        private static final String ESC_QUOTE = new String(new char[] { BACKSLASH, '"' });
        private static final String ESC_BACKSLASH = new String(new char[] { BACKSLASH, BACKSLASH });
        private static final String ESC_N = new String(new char[] { BACKSLASH, 'n' });
        private static final String ESC_R = new String(new char[] { BACKSLASH, 'r' });
        private static final String ESC_T = new String(new char[] { BACKSLASH, 't' });
        private static final String ESC_U = new String(new char[] { BACKSLASH, 'u' });

        static void write(StringBuilder b, Object o) {
            if (o == null) {
                b.append("null");
                return;
            }
            if (o instanceof String) {
                esc(b, (String) o);
                return;
            }
            if (o instanceof Boolean || o instanceof Number) {
                b.append(o.toString());
                return;
            }
            if (o instanceof Map) {
                b.append('{');
                boolean first = true;
                for (Map.Entry<?, ?> e : ((Map<?, ?>) o).entrySet()) {
                    if (!first) b.append(',');
                    first = false;
                    esc(b, String.valueOf(e.getKey()));
                    b.append(':');
                    write(b, e.getValue());
                }
                b.append('}');
                return;
            }
            if (o instanceof Iterable) {
                b.append('[');
                boolean first = true;
                for (Object e : (Iterable<?>) o) {
                    if (!first) b.append(',');
                    first = false;
                    write(b, e);
                }
                b.append(']');
                return;
            }
            esc(b, o.toString());
        }

        static void esc(StringBuilder b, String v) {
            b.append('"');
            for (int k = 0; k < v.length(); k++) {
                char c = v.charAt(k);
                if (c == '"') {
                    b.append(ESC_QUOTE);
                } else if (c == BACKSLASH) {
                    b.append(ESC_BACKSLASH);
                } else if (c == '\n') {
                    b.append(ESC_N);
                } else if (c == '\r') {
                    b.append(ESC_R);
                } else if (c == '\t') {
                    b.append(ESC_T);
                } else if (c < 0x20) {
                    b.append(ESC_U);
                    String h = Integer.toHexString(c);
                    for (int pad = h.length(); pad < 4; pad++) b.append('0');
                    b.append(h);
                } else {
                    b.append(c);
                }
            }
            b.append('"');
        }
    }
}
