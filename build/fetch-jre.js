/**
 * Builds the Java runtime that ships with the extension, into jre/.
 *
 * JDBC connections need a JVM. Asking every user to install one is a real
 * barrier for a feature that is otherwise a single click, so a cut-down
 * runtime is packaged instead and preferred over anything on PATH.
 *
 * Eclipse Temurin, because it is GPLv2 with the Classpath Exception and so
 * may be redistributed; the Oracle JDK may not be, under its licence. jlink
 * trims it to the modules the bridge and the drivers actually use, which takes
 * it from about 195MB to about 50MB. The licence files jlink copies into
 * legal/ ship with it.
 *
 * Run `node build/fetch-jre.js` to produce it, and `--force` to rebuild. The
 * result is deliberately not committed: it is a build output, and a platform
 * specific one.
 */
const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TARGET = path.join(ROOT, "jre");
const WORK = path.join(os.tmpdir(), "dbclient-jre-build");

// Only the modules the bridge and the bundled drivers reach for. java.desktop
// is in because a few drivers touch java.awt datatransfer through their
// logging, and java.security.jgss and sasl because Kerberos and SCRAM auth
// need them.
const MODULES = [
    "java.base", "java.sql", "java.naming", "java.logging", "java.management",
    "java.security.jgss", "java.security.sasl", "java.transaction.xa",
    "java.xml", "java.desktop", "jdk.crypto.ec", "jdk.crypto.cryptoki",
    "jdk.unsupported", "jdk.net",
].join(",");

const PLATFORM = { win32: "windows", darwin: "mac", linux: "linux" }[process.platform];
const ARCH = { x64: "x64", arm64: "aarch64" }[process.arch];

function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "dbclient-build" } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                return resolve(get(res.headers.location));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`${url} returned ${res.statusCode}`));
            }
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => resolve(Buffer.concat(chunks)));
            res.on("error", reject);
        }).on("error", reject);
    });
}

(async () => {
    if (!PLATFORM || !ARCH) {
        console.error(`fetch-jre: no Temurin build mapped for ${process.platform}/${process.arch}`);
        process.exit(1);
    }
    if (fs.existsSync(TARGET) && !process.argv.includes("--force")) {
        console.log("fetch-jre: jre/ already present, pass --force to rebuild");
        return;
    }

    const api = `https://api.adoptium.net/v3/assets/latest/21/hotspot` +
        `?architecture=${ARCH}&image_type=jdk&os=${PLATFORM}&vendor=eclipse`;
    console.log("fetch-jre: asking Adoptium for the current Temurin 21 build");
    const assets = JSON.parse((await get(api)).toString("utf8"));
    if (!assets.length) { throw new Error("Adoptium returned no build for this platform"); }
    const binary = assets[0].binary.package;
    console.log(`fetch-jre: ${assets[0].release_name}, ${(binary.size / 1048576).toFixed(0)}MB`);

    fs.mkdirSync(WORK, { recursive: true });
    const archive = path.join(WORK, path.basename(binary.link).replace(/[?#].*$/, ""));

    if (!fs.existsSync(archive) || crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex") !== binary.checksum) {
        console.log("fetch-jre: downloading");
        const data = await get(binary.link);
        const digest = crypto.createHash("sha256").update(data).digest("hex");
        if (digest !== binary.checksum) {
            throw new Error(`checksum mismatch: expected ${binary.checksum}, got ${digest}`);
        }
        fs.writeFileSync(archive, data);
    }
    console.log("fetch-jre: checksum verified");

    const extracted = path.join(WORK, "extracted");
    fs.rmSync(extracted, { recursive: true, force: true });
    fs.mkdirSync(extracted, { recursive: true });
    if (archive.endsWith(".zip")) {
        execFileSync("powershell", ["-NoProfile", "-Command",
            `Expand-Archive -Path '${archive}' -DestinationPath '${extracted}' -Force`], { stdio: "inherit" });
    } else {
        execFileSync("tar", ["-xf", archive, "-C", extracted], { stdio: "inherit" });
    }

    const [home] = fs.readdirSync(extracted).map((d) => path.join(extracted, d));
    const jdkHome = fs.existsSync(path.join(home, "Contents", "Home"))
        ? path.join(home, "Contents", "Home") : home;
    const jlink = path.join(jdkHome, "bin", process.platform === "win32" ? "jlink.exe" : "jlink");

    fs.rmSync(TARGET, { recursive: true, force: true });
    console.log("fetch-jre: trimming with jlink");
    execFileSync(jlink, [
        "--add-modules", MODULES,
        "--strip-debug", "--no-header-files", "--no-man-pages",
        "--compress=zip-6",
        "--output", TARGET,
    ], { stdio: "inherit" });

    const size = execFileSync(process.platform === "win32" ? "powershell" : "du",
        process.platform === "win32"
            ? ["-NoProfile", "-Command", `"{0:N0}" -f ((Get-ChildItem -Recurse '${TARGET}' | Measure-Object Length -Sum).Sum / 1MB)`]
            : ["-sh", TARGET]).toString().trim();
    console.log(`fetch-jre: jre/ built, ${size}${process.platform === "win32" ? " MB" : ""}`);
})().catch((err) => {
    console.error("fetch-jre: " + err.message);
    process.exit(1);
});
