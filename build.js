const { build } = require("esbuild")
const { copyFileSync, mkdirSync } = require("fs")

// VS Code resolves "vscode:uninstall" against the extension folder and runs it
// with plain node, so it must be a real file in out/ rather than part of the
// bundle.
mkdirSync("out", { recursive: true })
copyFileSync("build/uninstall.js", "out/uninstall.js")

// Compile the JDBC bridge so it runs on a JRE rather than needing a full JDK.
require("./build/compile-bridge")

build({
    entryPoints: ['./src/extension.ts'],
    format: 'cjs',
    bundle: true,
    outfile: "out/extension.js",
    platform: 'node',
    logLevel: 'error',
    metafile: true,
    sourcemap:'external',
    sourceRoot:__dirname,
    minify:false,
    watch:false,
    external: ['vscode', 'pg-native', 'cardinal', 'aws4', 'mongodb-client-encryption', 'cpu-features'],
    plugins: [
        {
            name: 'build notice',
            setup(build) {
                console.log('build')
            },
        },
    ],
})