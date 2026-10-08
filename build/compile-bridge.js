/**
 * Compiles jdbc/JdbcBridge.java at build time.
 *
 * The bridge used to be launched as `java JdbcBridge.java`, Java's single file
 * source mode, which invokes the compiler at startup and therefore needs a full
 * JDK on the user's machine. Shipping the classes means `java -cp ... JdbcBridge`
 * runs on a plain JRE, and skips a compile on every connection.
 *
 * Needs a JDK to build, not to run. Without one the classes are skipped and the
 * extension falls back to source mode, which is why this never fails the build.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "jdbc", "JdbcBridge.java");
const OUT = path.join(ROOT, "out", "jdbc-classes");

/** javac from JAVA_HOME, from PATH, or from a standard install. */
function findJavac() {
    const exe = process.platform === "win32" ? "javac.exe" : "javac";
    if (process.env.JAVA_HOME) {
        const candidate = path.join(process.env.JAVA_HOME, "bin", exe);
        if (fs.existsSync(candidate)) { return candidate; }
    }
    const roots = process.platform === "win32"
        ? ["C:/Program Files/Java", "C:/Program Files/Eclipse Adoptium", "C:/Program Files/Microsoft"]
        : ["/usr/lib/jvm", "/Library/Java/JavaVirtualMachines"];
    for (const root of roots) {
        let entries = [];
        try { entries = fs.readdirSync(root); } catch (err) { continue; }
        for (const entry of entries) {
            for (const candidate of [
                path.join(root, entry, "bin", exe),
                path.join(root, entry, "Contents", "Home", "bin", exe),
            ]) {
                if (fs.existsSync(candidate)) { return candidate; }
            }
        }
    }
    return exe; // let PATH resolve it, and report if it cannot
}

function driverJars() {
    const dir = path.join(ROOT, "jdbc", "drivers");
    try {
        return fs.readdirSync(dir).filter(f => f.endsWith(".jar")).map(f => path.join(dir, f));
    } catch (err) {
        return [];
    }
}

if (!fs.existsSync(SOURCE)) {
    console.error("compile-bridge: " + SOURCE + " is missing");
    process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const javac = findJavac();
const separator = process.platform === "win32" ? ";" : ":";
const args = ["-nowarn", "-d", OUT];
const jars = driverJars();
if (jars.length) { args.push("-cp", jars.join(separator)); }
args.push(SOURCE);

try {
    execFileSync(javac, args, { stdio: ["ignore", "pipe", "pipe"] });
    const produced = fs.readdirSync(OUT).filter(f => f.endsWith(".class"));
    console.log(`compiled JdbcBridge: ${produced.length} classes (a JRE is enough to run it)`);
} catch (err) {
    fs.rmSync(OUT, { recursive: true, force: true });
    const reason = (err.stderr && err.stderr.toString().trim().split("\n")[0]) || err.message;
    console.warn("compile-bridge: skipped, falling back to source mode at runtime -- " + reason);
}
