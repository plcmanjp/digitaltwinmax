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
  const HASH_PATTERN = /\b([0-9a-fA-F]{64})\b/g;

  function extractSha256(notes, assetName, assetCount = 1) {
    if (typeof notes !== "string" || !notes.trim() || typeof assetName !== "string" || !assetName) return "";
    const lines = notes.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes(assetName)) continue;
      const sameLine = lines[i].match(/\b([0-9a-fA-F]{64})\b/);
      if (sameLine) return sameLine[1].toLowerCase();
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].match(/\b([0-9a-fA-F]{64})\b/);
        if (nextLine && !/DigitalTwinMax-Trial-/.test(lines[i + 1])) return nextLine[1].toLowerCase();
      }
    }
    if (assetCount === 1) {
      const unique = new Set();
      let match;
      HASH_PATTERN.lastIndex = 0;
      while ((match = HASH_PATTERN.exec(notes)) !== null) unique.add(match[1].toLowerCase());
      if (unique.size === 1) return [...unique][0];
    }
    return "";
  }

  // The landing shows only the opening paragraph of a release body. The first line is the
  // title; reading stops at the first Markdown heading. Paragraphs that carry a file name or
  // a hash belong to the download block and are skipped.
  function extractSummary(notes, maxLength = 240) {
    if (typeof notes !== "string" || !notes.trim()) return "";
    const lines = notes.replace(/\r\n?/g, "\n").split("\n");
    let index = 0;
    while (index < lines.length && !lines[index].trim()) index++;
    index++;
    const paragraphs = [];
    let current = [];
    for (; index < lines.length; index++) {
      const line = lines[index].trim();
      if (/^#{1,6}\s/.test(line)) break;
      if (!line) {
        if (current.length) paragraphs.push(current.join(" "));
        current = [];
        continue;
      }
      current.push(line);
    }
    if (current.length) paragraphs.push(current.join(" "));
    const chosen = paragraphs.find(text => !/\b[0-9a-fA-F]{64}\b/.test(text) && !/DigitalTwinMax-Trial-/.test(text));
    if (!chosen) return "";
    let text = chosen
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > maxLength) {
      const cut = text.lastIndexOf(". ", maxLength);
      text = cut > 40 ? text.slice(0, cut + 1) : `${text.slice(0, maxLength).trimEnd()}...`;
    }
    return text;
  }

  return Object.freeze({ RELEASES_URL, API_URL, selectTrial, loadTrial, extractSha256, extractSummary, ReleaseError });
});
