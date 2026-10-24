(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DTMMedia = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const extensions = {
    image: /\.(?:avif|webp|png|jpe?g|svg)$/i,
    video: /\.(?:mp4|webm)$/i,
    captions: /\.vtt$/i,
    transcript: /\.(?:txt|html)$/i
  };
  const text = (value, fallback = "", limit = 500) => typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : fallback;
  function localAsset(value, kind) {
    if (typeof value !== "string" || !/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(value) || value.includes("..")) return "";
    return extensions[kind]?.test(value) ? value : "";
  }
  function normalizeItems(input, kind) {
    if (!Array.isArray(input) || !["images", "videos"].includes(kind)) return [];
    return input.filter(item => item && typeof item === "object" && item.published !== false).flatMap((item, index) => {
      const src = localAsset(item.src, kind === "images" ? "image" : "video");
      if (!src) return [];
      if (kind === "images") {
        const alt = text(item.alt);
        return alt ? [{ src, alt, title: text(item.title, `이미지 ${index + 1}`, 160), caption: text(item.caption, "", 1000) }] : [];
      }
      const poster = localAsset(item.poster, "image");
      const title = text(item.title, "", 160);
      const captions = localAsset(item.captions, "captions");
      if (!poster || !title || (!captions && item.silent !== true)) return [];
      return [{ src, poster, title, captions, silent: item.silent === true,
        caption: text(item.caption, "", 1000), language: /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(item.language) ? item.language : "ko",
        captionLabel: text(item.captionLabel, "한국어", 60), transcript: localAsset(item.transcript, "transcript") }];
    });
  }
  const clampIndex = (index, total) => Math.max(0, Math.min(Math.round(Number(index) || 0), Math.max(0, total - 1)));
  function closestIndex(left, offsets) {
    return offsets.reduce((best, offset, index) => Math.abs(left - offset) < Math.abs(left - offsets[best]) ? index : best, 0);
  }
  function mount(section, input, kind) {
    const items = normalizeItems(input, kind);
    const gallery = section.querySelector(".gallery");
    const empty = section.querySelector(".media-empty");
    const state = section.querySelector(".collection-state");
    if (!gallery || !items.length) return null;
    const doc = section.ownerDocument;
    const win = doc.defaultView;
    const make = (tag, cls, value) => {
      const node = doc.createElement(tag);
      if (cls) node.className = cls;
      if (value) node.textContent = value;
      return node;
    };
    const name = kind === "images" ? "이미지" : "영상";
    const track = make("div", "gallery-track");
    track.id = `${section.id}-track`;
    track.setAttribute("role", "region");
    track.setAttribute("aria-roledescription", "캐러셀");
    track.setAttribute("aria-label", `${name} 모음`);
    track.tabIndex = items.length > 1 ? 0 : -1;
    const videos = [];
    const slides = items.map((item, index) => {
      const slide = make("figure", "gallery-slide");
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "슬라이드");
      slide.setAttribute("aria-label", `${items.length}개 중 ${index + 1}: ${item.title}`);
      const stage = make("div", "media-stage");
      const failure = make("div", "media-failure");
      failure.hidden = true;
      failure.setAttribute("role", "status");
      failure.append(make("strong", "", `${name}을 불러올 수 없습니다.`), make("span", "", "잠시 후 페이지를 새로고침해 주세요."));
      const media = make(kind === "images" ? "img" : "video");
      media.addEventListener("error", () => {
        if (kind === "videos") media.pause();
        slide.classList.add("media-error");
        failure.hidden = false;
      }, { once: true });
      if (kind === "images") {
        media.alt = item.alt;
        media.loading = index ? "lazy" : "eager";
        media.decoding = "async";
        media.width = 1600;
        media.height = 900;
      } else {
        media.controls = true;
        media.preload = "none";
        media.playsInline = true;
        media.muted = true;
        media.defaultMuted = true;
        media.poster = item.poster;
        media.setAttribute("aria-label", item.title);
        media.setAttribute("aria-describedby", `${section.id}-caption-${index}`);
        media.tabIndex = index ? -1 : 0;
        videos.push(media);
        if (item.captions) {
          const captions = make("track");
          captions.kind = "captions";
          captions.src = item.captions;
          captions.srclang = item.language;
          captions.label = item.captionLabel;
          captions.default = true;
          captions.addEventListener("error", () => {
            const note = slide.querySelector(".caption-warning");
            if (note) note.hidden = false;
          }, { once: true });
          media.append(captions);
        }
        media.addEventListener("play", () => {
          videos.forEach(other => { if (other !== media) other.pause(); });
          if (index !== current) go(index);
        });
      }
      media.src = item.src;
      stage.append(media, failure);
      const caption = make("figcaption", "media-caption");
      caption.id = `${section.id}-caption-${index}`;
      const copy = make("div");
      copy.append(make("strong", "", item.title));
      if (item.caption) copy.append(make("p", "", item.caption));
      if (kind === "videos") {
        copy.append(make("p", "", item.silent ? "무음 영상 · 재생 버튼을 눌러 시작하세요." : "재생 버튼을 눌러 시작하세요. 기본 음소거 · 자막 제공"));
        if (item.captions) {
          const warning = make("p", "caption-warning", item.transcript ? "자막을 불러올 수 없습니다. 영상 내용 읽기를 이용하거나 잠시 후 다시 확인해 주세요." : "자막을 불러올 수 없습니다. 잠시 후 다시 확인해 주세요.");
          warning.hidden = true;
          warning.setAttribute("role", "status");
          copy.append(warning);
        }
      }
      caption.append(copy);
      if (item.transcript) {
        const link = make("a", "", "영상 내용 읽기 ↗");
        link.href = item.transcript;
        caption.append(link);
      }
      slide.append(stage, caption);
      return slide;
    });
    track.append(...slides);
    const bar = make("div", "gallery-bar");
    const hint = make("p", "gallery-hint", "좌우로 넘겨 보세요.");
    hint.id = `${section.id}-hint`;
    if (items.length > 1) track.setAttribute("aria-describedby", hint.id);
    const controls = make("div", "gallery-controls");
    const position = make("span", "gallery-position");
    position.setAttribute("aria-live", "polite");
    position.setAttribute("aria-atomic", "true");
    const previous = make("button", "gallery-button", "←");
    const next = make("button", "gallery-button", "→");
    for (const [button, label] of [[previous, `이전 ${name}`], [next, `다음 ${name}`]]) {
      button.type = "button";
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-controls", track.id);
    }
    controls.append(position, previous, next);
    bar.append(hint, controls);
    gallery.append(track, bar);
    gallery.classList.toggle("is-single", items.length === 1);
    gallery.hidden = false;
    if (empty) empty.hidden = true;
    if (state) state.textContent = `${String(items.length).padStart(2, "0")} ${kind === "images" ? "IMAGES" : "FILMS"}`;
    section.classList.add("has-media");
    let current = 0;
    let destination = null;
    let settleTimer;
    let frame;
    const offsets = () => slides.map(slide => Math.min(slide.offsetLeft - slides[0].offsetLeft, Math.max(0, track.scrollWidth - track.clientWidth)));
    function update(index) {
      current = clampIndex(index, items.length);
      position.textContent = `${String(current + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
      previous.setAttribute("aria-disabled", String(current === 0));
      next.setAttribute("aria-disabled", String(current === items.length - 1));
      videos.forEach((video, i) => {
        video.tabIndex = i === current ? 0 : -1;
        if (i !== current) video.pause();
      });
    }
    function go(index, instant = false) {
      const target = clampIndex(index, items.length);
      destination = target;
      update(target);
      const reduced = win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      track.scrollTo({ left: offsets()[target], behavior: instant || reduced ? "auto" : "smooth" });
      win.clearTimeout(settleTimer);
      settleTimer = win.setTimeout(settle, instant || reduced ? 0 : 500);
    }
    function settle() {
      destination = null;
      update(closestIndex(track.scrollLeft, offsets()));
    }
    previous.addEventListener("click", () => { if (current > 0) go(current - 1); });
    next.addEventListener("click", () => { if (current < items.length - 1) go(current + 1); });
    track.addEventListener("keydown", event => {
      // Native video controls and links keep their own keyboard behavior.
      if (event.target !== track || items.length < 2) return;
      const target = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: items.length - 1 }[event.key];
      if (target === undefined) return;
      event.preventDefault();
      go(target);
    });
    const takeOver = () => { destination = null; win.clearTimeout(settleTimer); };
    track.addEventListener("pointerdown", takeOver, { passive: true });
    track.addEventListener("wheel", takeOver, { passive: true });
    track.addEventListener("scroll", () => {
      if (!frame) frame = win.requestAnimationFrame(() => {
        frame = null;
        if (destination === null) update(closestIndex(track.scrollLeft, offsets()));
      });
      win.clearTimeout(settleTimer);
      settleTimer = win.setTimeout(settle, 140);
    }, { passive: true });
    track.addEventListener("scrollend", settle);
    if (win.ResizeObserver) new win.ResizeObserver(() => go(current, true)).observe(track);
    if (win.IntersectionObserver) {
      const observer = new win.IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.intersectionRatio < .45) entry.target.pause(); });
      }, { threshold: [0, .45] });
      videos.forEach(video => observer.observe(video));
    }
    const pauseAll = () => videos.forEach(video => video.pause());
    doc.addEventListener("visibilitychange", () => { if (doc.hidden) pauseAll(); });
    win.addEventListener("pagehide", pauseAll);
    update(0);
    return { go, track, slides, get index() { return current; } };
  }
  return { localAsset, normalizeItems, clampIndex, closestIndex, mount };
});
