/**
 * Builds the .vsix.
 *
 * A .vsix is an OPC zip: every extension file under "extension/", plus
 * extension.vsixmanifest and [Content_Types].xml at the root. vsce does this
 * too, but it is not a dependency of this repo, and packaging the release
 * should not require a network fetch.
 *
 * Run after `npm run build` -- it packages what is on disk, it does not build.
 */
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const ROOT = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const OUT = path.join(ROOT, `${manifest.name}-${manifest.version}.vsix`);

// ------------------------------------------------------------- ignore rules
/** .vscodeignore, as the subset of glob syntax this repo actually uses. */
function ignoreMatchers() {
    const file = path.join(ROOT, ".vscodeignore");
    const lines = fs.existsSync(file)
        ? fs.readFileSync(file, "utf8").split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"))
        : [];
    // "**" must survive the single-"*" pass, so park it on a character that
    // cannot appear in a path pattern first.
    const SENTINEL = "";
    return lines.map(pattern => {
        const source = "^" + pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*\*\/?/g, SENTINEL)
            .replace(/\*/g, "[^/]*")
            .split(SENTINEL).join(".*")
            .replace(/\/$/, "/.*") + "$";
        const re = new RegExp(source);
        return (rel) => re.test(rel) || re.test(rel + "/") ||
            // "node_modules/" and "e2e/" are meant to cover everything inside
            (pattern.endsWith("/") && rel.startsWith(pattern));
    });
}

const ignores = ignoreMatchers();
const ALWAYS_SKIP = new Set([".git", "node_modules", ".vscode-test", "dist-bundle"]);

function ignored(rel) {
    return ignores.some(match => match(rel));
}

function walk(dir, acc) {
    acc = acc || [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        const rel = path.relative(ROOT, abs).split(path.sep).join("/");
        if (entry.isDirectory()) {
            if (ALWAYS_SKIP.has(entry.name)) { continue; }
            if (ignored(rel) || ignored(rel + "/")) { continue; }
            walk(abs, acc);
        } else {
            if (ignored(rel)) { continue; }
            acc.push(rel);
        }
    }
    return acc;
}

// ------------------------------------------------------------- the manifest
function xmlEscape(value) {
    return String(value || "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function vsixManifest(files) {
    const repo = (manifest.repository && manifest.repository.url) || "";
    const asset = (type, p) => files.includes(p)
        ? `\n\t\t\t<Asset Type="${type}" Path="extension/${p}" Addressable="true" />` : "";
    const readme = files.includes("readme.md") ? "readme.md" : files.includes("README.md") ? "README.md" : null;
    const license = files.includes("LICENSE.txt") ? "LICENSE.txt" : files.includes("LICENSE") ? "LICENSE" : null;

    return `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
\t<Metadata>
\t\t<Identity Language="en-US" Id="${xmlEscape(manifest.name)}" Version="${xmlEscape(manifest.version)}" Publisher="${xmlEscape(manifest.publisher)}" />
\t\t<DisplayName>${xmlEscape(manifest.displayName)}</DisplayName>
\t\t<Description xml:space="preserve">${xmlEscape(manifest.description)}</Description>
\t\t<Tags>${xmlEscape((manifest.keywords || []).join(","))}</Tags>
\t\t<Categories>${xmlEscape((manifest.categories || []).join(","))}</Categories>
\t\t<GalleryFlags>Public</GalleryFlags>
\t\t<Properties>
\t\t\t<Property Id="Microsoft.VisualStudio.Code.Engine" Value="${xmlEscape(manifest.engines.vscode)}" />
\t\t\t<Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
\t\t\t<Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
\t\t\t<Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace" />
\t\t\t<Property Id="Microsoft.VisualStudio.Code.LocalizedLanguages" Value="" />
\t\t\t<Property Id="Microsoft.VisualStudio.Code.EnabledApiProposals" Value="" />
\t\t\t<Property Id="Microsoft.VisualStudio.Code.ExecutesCode" Value="true" />
\t\t\t<Property Id="Microsoft.VisualStudio.Services.Links.Source" Value="${xmlEscape(repo)}" />
\t\t\t<Property Id="Microsoft.VisualStudio.Services.Links.Getstarted" Value="${xmlEscape(repo)}" />
\t\t\t<Property Id="Microsoft.VisualStudio.Services.Links.GitHub" Value="${xmlEscape(repo)}" />
\t\t\t<Property Id="Microsoft.VisualStudio.Services.GitHubFlavoredMarkdown" Value="true" />
\t\t\t<Property Id="Microsoft.VisualStudio.Services.Content.Pricing" Value="Free"/>
\t\t</Properties>${license ? `\n\t\t<License>extension/${license}</License>` : ""}${manifest.icon ? `\n\t\t<Icon>extension/${manifest.icon}</Icon>` : ""}
\t</Metadata>
\t<Installation>
\t\t<InstallationTarget Id="Microsoft.VisualStudio.Code"/>
\t</Installation>
\t<Dependencies/>
\t<Assets>
\t\t\t<Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />${readme ? asset("Microsoft.VisualStudio.Services.Content.Details", readme) : ""}${asset("Microsoft.VisualStudio.Services.Content.Changelog", "changelog.md")}${license ? asset("Microsoft.VisualStudio.Services.Content.License", license) : ""}${manifest.icon ? asset("Microsoft.VisualStudio.Services.Icons.Default", manifest.icon) : ""}
\t</Assets>
</PackageManifest>`;
}

const CONTENT_TYPES = {
    ".css": "text/css", ".exe": "application/octet-stream", ".html": "text/html",
    ".jar": "application/java-archive", ".java": "text/x-java-source",
    ".js": "application/javascript", ".json": "application/json", ".md": "text/markdown",
    ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain",
    ".vsixmanifest": "text/xml", ".woff": "font/woff", ".map": "application/json",
    ".sql": "text/plain", ".db": "application/octet-stream", ".gif": "image/gif",
    ".jpg": "image/jpeg", ".ttf": "font/ttf", ".eot": "application/vnd.ms-fontobject",
    ".yml": "text/yaml", ".node": "application/octet-stream", ".dll": "application/octet-stream",
};

function contentTypes(files) {
    const seen = new Set([".vsixmanifest"]);
    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (ext) { seen.add(ext); }
    }
    const defaults = [...seen].sort().map(ext =>
        `<Default Extension="${ext}" ContentType="${CONTENT_TYPES[ext] || "application/octet-stream"}"/>`).join("");
    return `<?xml version="1.0" encoding="utf-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaults}</Types>`;
}

// ------------------------------------------------------------------- build
const files = walk(ROOT);

if (!files.includes("out/extension.js")) {
    console.error("package-vsix: out/extension.js is missing -- run `npm run build` first");
    process.exit(1);
}
if (!files.includes("out/uninstall.js")) {
    console.error("package-vsix: out/uninstall.js is missing -- the uninstall hook would not ship");
    process.exit(1);
}

const output = fs.createWriteStream(OUT);
const zip = archiver("zip", { zlib: { level: 9 } });
zip.pipe(output);

for (const rel of files) {
    zip.file(path.join(ROOT, rel), { name: `extension/${rel}` });
}
zip.append(vsixManifest(files), { name: "extension.vsixmanifest" });
zip.append(contentTypes(files), { name: "[Content_Types].xml" });

output.on("close", () => {
    const mb = (zip.pointer() / 1048576).toFixed(1);
    console.log(`packaged ${path.basename(OUT)}  ${mb} MB  (${files.length} files)`);
});
zip.on("warning", err => console.error("warning:", err.message));
zip.on("error", err => { console.error(err); process.exit(1); });
zip.finalize();
