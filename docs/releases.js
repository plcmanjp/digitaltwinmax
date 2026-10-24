/* Public GitHub Releases only. No authentication, embedded credentials or binary downloads. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DTMReleases = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const REPOSITORY = "plcmanjp/digitaltwinmax";
  const RELEASES_URL = `https://github.com/${REPOSITORY}/releases`;
  const API_URL = `https://api.github.com/repos/${REPOSITORY}/releases`;
  const TAG_PATTERN = /^trial-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?)$/;
  const MAX_PAGES = 3;

  class ReleaseError extends Error {
    constructor(code) { super(code); this.name = "ReleaseError"; this.code = code; }
  }

  function validateList(releases) {
    if (!Array.isArray(releases) || releases.some(release =>
      !release || typeof release.tag_name !== "string" ||
      typeof release.draft !== "boolean" || typeof release.prerelease !== "boolean" ||
      !Array.isArray(release.assets) || typeof release.html_url !== "string"
    )) throw new ReleaseError("format");
  }

  function selectTrial(releases) {
    validateList(releases);
    const candidates = releases.filter(release => {
      const tag = TAG_PATTERN.exec(release.tag_name);
      return tag && !release.draft && typeof release.published_at === "string" &&
        Number.isFinite(Date.parse(release.published_at)) &&
        release.html_url === `${RELEASES_URL}/tag/${release.tag_name}`;
    }).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) ||
      b.tag_name.localeCompare(a.tag_name, "en"));

    if (!candidates.length) return { state: "empty" };
    // Never silently fall back to an older trial if the newest trial has no eligible files.
    const release = candidates[0];
    const version = TAG_PATTERN.exec(release.tag_name)[1];
    const prefix = `DigitalTwinMax-Trial-${version}-windows-`;
    const seen = new Set();
    const assets = [];
    for (const asset of release.assets) {
      if (!asset || typeof asset.name !== "string" || !asset.name.startsWith(prefix)) continue;
      const match = /^(x64|arm64)\.(exe|msi|zip)$/.exec(asset.name.slice(prefix.length));
      const expectedUrl = `${RELEASES_URL}/download/${release.tag_name}/${asset.name}`;
      if (!match || asset.state !== "uploaded" || !Number.isSafeInteger(asset.size) ||
          asset.size <= 0 || asset.browser_download_url !== expectedUrl || seen.has(asset.name)) continue;
      seen.add(asset.name);
      assets.push({ name: asset.name, url: expectedUrl, size: asset.size, arch: match[1], format: match[2] });
    }
    const order = { x64: 0, arm64: 1, exe: 0, msi: 1, zip: 2 };
    assets.sort((a, b) => order[a.arch] - order[b.arch] || order[a.format] - order[b.format]);
    return {
      state: assets.length ? "available" : "no-files",
      version, tag: release.tag_name, prerelease: release.prerelease,
      publishedAt: release.published_at, url: release.html_url,
      notes: typeof release.body === "string" ? release.body : "",
      assets
    };
  }

  async function loadTrial({ fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const releases = [];
    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const response = await fetchImpl(`${API_URL}?per_page=100&page=${page}`, {
          headers: { Accept: "application/vnd.github+json" },
          credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
          signal: controller.signal
        });
        if (!response.ok) throw new ReleaseError([403, 429].includes(response.status) ? "rate-limit" : "http");
        const items = await response.json();
        validateList(items);
        if (items.length > 100) throw new ReleaseError("format");
        releases.push(...items);
        // Only use Link as a pagination signal. Never follow a URL supplied by a response.
        const hasNext = /rel="next"/.test(response.headers.get("link") || "");
        if (!hasNext) return selectTrial(releases);
      }
      throw new ReleaseError("limit");
    } catch (error) {
      if (error instanceof ReleaseError) throw error;
      if (controller.signal.aborted || error.name === "AbortError") throw new ReleaseError("timeout");
      if (error instanceof SyntaxError) throw new ReleaseError("format");
      throw new ReleaseError("network");
    } finally {
      clearTimeout(timer);
    }
  }
  return Object.freeze({ RELEASES_URL, API_URL, selectTrial, loadTrial, ReleaseError });
});
