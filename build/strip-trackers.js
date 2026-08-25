/**
 * Neutralises analytics beacons that ship inside third party webview bundles.
 *
 * g2 v2 (AntV, from Ant Group) contains a tracking module that sets
 *   image.src = "https://kcart.alipay.com/web/bi.do?BIProfile=merge&d=" + payload
 * where the payload includes document.URL and a timestamp. src/vue/status
 * constructs a g2 Chart, so this fires when the status dashboard opens.
 *
 * This extension is offline-only, so the host is rewritten to an inert data URI
 * at build time. The tracking code still runs, it just cannot leave the machine:
 * assigning a data: URI to image.src performs no network request.
 *
 * Patching the emitted asset rather than the module keeps this independent of
 * how the dependency is bundled or which version is installed.
 */
class StripTrackersPlugin {
  constructor(options = {}) {
    // host -> replacement. Replacements must stay the same "shape" (a URL
    // prefix that the library concatenates a query string onto).
    this.replacements = options.replacements || [
      { find: "https://kcart.alipay.com/web/bi.do", replace: "data:,tracking-disabled" },
    ];
    this.assetFilter = options.assetFilter || (name => name.endsWith(".js"));
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync("StripTrackersPlugin", (compilation, callback) => {
      let total = 0;
      for (const name of Object.keys(compilation.assets)) {
        if (!this.assetFilter(name)) continue;
        const asset = compilation.assets[name];
        let source = asset.source();
        if (typeof source !== "string") continue;

        let hits = 0;
        for (const r of this.replacements) {
          if (source.indexOf(r.find) === -1) continue;
          hits += source.split(r.find).length - 1;
          source = source.split(r.find).join(r.replace);
        }
        if (!hits) continue;

        total += hits;
        compilation.assets[name] = {
          source: () => source,
          size: () => source.length,
        };
        console.log(`[strip-trackers] ${name}: neutralised ${hits} beacon URL(s)`);
      }
      if (total === 0) {
        console.log("[strip-trackers] no beacon URLs found");
      }
      callback();
    });
  }
}

module.exports = StripTrackersPlugin;
