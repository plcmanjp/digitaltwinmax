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
    const failedCaptions = new Set();
    let current = 0;
    const caption = make("div", "media-caption");
    caption.id = `${section.id}-caption`;
    const captionCopy = make("div");
    const captionTitle = make("strong");
    const captionBody = make("p");
    const captionNote = make("p");
    const captionWarning = make("p", "caption-warning");
    captionWarning.hidden = true;
    captionWarning.setAttribute("role", "status");
    const captionLink = make("a", "", "영상 내용 읽기 ↗");
    captionCopy.append(captionTitle, captionBody, captionNote, captionWarning);
    caption.append(captionCopy);
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
        media.setAttribute("aria-describedby", `${section.id}-caption`);
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
            failedCaptions.add(index);
            if (index === current) captionWarning.hidden = false;
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
      slide.addEventListener("click", event => {
        if (index === current) return;
        let node = event.target;
        while (node && node !== slide) {
          if (node.tagName === "A") return;
          node = node.parent;
        }
        go(index);
      });
      slide.append(stage);
      return slide;
    });
    track.append(...slides);
    const bar = make("div", "gallery-bar");
    const hint = make("p", "gallery-hint", items.length > 1 ? "포스터를 고르거나 끌어 장면을 바꾸세요." : "");
    hint.id = `${section.id}-hint`;
    if (items.length > 1) track.setAttribute("aria-describedby", hint.id);
    const position = make("span", "gallery-position");
    position.setAttribute("aria-live", "polite");
    position.setAttribute("aria-atomic", "true");
    const picker = make("div", "gallery-picker");
    picker.setAttribute("role", "toolbar");
    picker.setAttribute("aria-label", `${name} 선택`);
    picker.setAttribute("aria-orientation", "horizontal");
    let suppressClick = false;
    const picks = items.map((item, index) => {
      const button = make("button", "gallery-pick");
      button.type = "button";
      button.setAttribute("aria-controls", track.id);
      button.setAttribute("aria-label", `${index + 1}. ${item.title}`);
      const frame = make("span", "gallery-pick-frame");
      const thumb = make("img", "gallery-pick-image");
      thumb.alt = "";
      thumb.decoding = "async";
      thumb.loading = index ? "lazy" : "eager";
      thumb.src = kind === "videos" ? item.poster : item.src;
      frame.append(thumb);
      button.append(frame, make("span", "gallery-pick-title", item.title));
      button.addEventListener("click", () => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        go(index);
      });
      return button;
    });
    picker.append(...picks);
    bar.append(hint, position, picker);
    gallery.append(track, bar, caption);
    gallery.classList.toggle("is-single", items.length === 1);
    gallery.hidden = false;
    if (empty) empty.hidden = true;
    if (state) state.textContent = `${String(items.length).padStart(2, "0")} ${kind === "images" ? "IMAGES" : "FILMS"}`;
    section.classList.add("has-media");
    let destination = null;
    let settleTimer;
    let frame;
    let drag = null;
    const offsets = () => slides.map(slide => Math.min(slide.offsetLeft - slides[0].offsetLeft, Math.max(0, track.scrollWidth - track.clientWidth)));
    function renderCaption(index) {
      const item = items[index];
      captionTitle.textContent = item.title;
      captionBody.textContent = item.caption || "";
      captionBody.hidden = !item.caption;
      captionNote.hidden = kind !== "videos";
      captionNote.textContent = kind !== "videos" ? "" : item.silent ? "무음 영상입니다. 재생 버튼을 눌러 시작하세요." : "기본 음소거이며 자막을 제공합니다. 재생 버튼을 눌러 시작하세요.";
      captionWarning.textContent = item.transcript ? "자막을 불러올 수 없습니다. 영상 내용 읽기를 이용하거나 잠시 후 다시 확인해 주세요." : "자막을 불러올 수 없습니다. 잠시 후 다시 확인해 주세요.";
      captionWarning.hidden = !(kind === "videos" && failedCaptions.has(index));
      if (item.transcript) {
        captionLink.hidden = false;
        captionLink.href = item.transcript;
        if ((captionLink.parentElement || captionLink.parent) !== caption) caption.append(captionLink);
      } else {
        captionLink.remove?.();
      }
    }
    function update(index) {
      current = clampIndex(index, items.length);
      position.textContent = `${String(current + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
      renderCaption(current);
      picks.forEach((pick, i) => {
        pick.setAttribute("aria-current", String(i === current));
        pick.tabIndex = i === current || items.length < 2 ? 0 : -1;
      });
      slides.forEach((slide, i) => slide.classList.toggle("is-current", i === current));
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
    const indexAt = clientX => {
      let best = 0;
      let bestDistance = Infinity;
      picks.forEach((pick, index) => {
        if (typeof pick.getBoundingClientRect !== "function") return;
        const rect = pick.getBoundingClientRect();
        const distance = Math.abs(clientX - (rect.left + rect.width / 2));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      return best;
    };
    const endDrag = event => {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.moved) {
        suppressClick = true;
        win.setTimeout(() => { suppressClick = false; }, 0);
      }
      picker.classList.remove("is-grabbing");
      drag = null;
      win.removeEventListener?.("pointermove", onDragMove);
      win.removeEventListener?.("pointerup", endDrag);
      win.removeEventListener?.("pointercancel", endDrag);
    };
    const onDragMove = event => {
      if (!drag || event.pointerId !== drag.id) return;
      if (!drag.moved && Math.abs(event.clientX - drag.x) < 8) return;
      drag.moved = true;
      picker.classList.add("is-grabbing");
      const index = indexAt(event.clientX);
      if (index !== current) go(index);
    };
    picker.addEventListener("pointerdown", event => {
      if (event.button !== 0 || items.length < 2) return;
      drag = { id: event.pointerId, x: event.clientX, moved: false };
      // Keep the click on the poster. Capturing the pointer would retarget that click.
      win.addEventListener?.("pointermove", onDragMove);
      win.addEventListener?.("pointerup", endDrag);
      win.addEventListener?.("pointercancel", endDrag);
    });
    picker.addEventListener("pointermove", onDragMove);
    picker.addEventListener("pointerup", endDrag);
    picker.addEventListener("pointercancel", endDrag);
    picker.addEventListener("keydown", event => {
      if (!event.target?.classList?.contains("gallery-pick") || items.length < 2) return;
      const target = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: items.length - 1 }[event.key];
      if (target === undefined) return;
      event.preventDefault();
      const index = clampIndex(target, items.length);
      go(index);
      picks[index].focus?.();
    });
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
  // One controller per document: the most visible video (at least 60%) plays,
  // every other video pauses. Reduced motion disables automatic playback.
  const controllers = new WeakMap();
  const PLAY_RATIO = .6;
  function autoplayController(doc) {
    if (controllers.has(doc)) return controllers.get(doc);
    const win = doc.defaultView;
    const states = new Map();
    let active = null;
    const reduced = () => Boolean(win.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    const start = video => {
      const result = video.play?.();
      if (result && typeof result.catch === "function") result.catch(() => {});
    };
    function choose() {
      let best = null;
      let bestRatio = 0;
      states.forEach((state, video) => {
        if (state.ratio >= PLAY_RATIO && state.ratio > bestRatio) {
          best = video;
          bestRatio = state.ratio;
        }
      });
      return best;
    }
    function refresh() {
      const next = doc.hidden ? null : choose();
      if (next !== active) {
        active?.pause();
        active = next;
        const state = active && states.get(active);
        if (state?.left) {
          state.left = false;
          try { active.currentTime = 0; } catch { /* metadata not loaded yet */ }
        }
      }
      states.forEach((state, video) => { if (video !== active && !video.paused) video.pause(); });
      if (active && active.paused && !states.get(active).userPaused && !reduced()) start(active);
    }
    const observer = win.IntersectionObserver ? new win.IntersectionObserver(entries => {
      entries.forEach(entry => {
        const state = states.get(entry.target);
        if (!state) return;
        state.ratio = Number(entry.intersectionRatio) || 0;
        if (state.ratio === 0) {
          state.left = true;
          state.userPaused = false;
        }
      });
      refresh();
    }, { threshold: [0, .25, .5, PLAY_RATIO, .75, .9, 1] }) : null;
    const nearby = win.IntersectionObserver ? new win.IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.intersectionRatio > 0 || entry.isIntersecting) entry.target.preload = "auto";
      });
    }, { rootMargin: "0px 0px 100% 0px" }) : null;
    doc.addEventListener("visibilitychange", refresh);
    win.addEventListener("pagehide", () => states.forEach((state, video) => video.pause()));
    const api = {
      observe(video) {
        states.set(video, { ratio: 0, left: false, userPaused: false });
        video.addEventListener("play", () => {
          if (active && active !== video) active.pause();
          active = video;
        });
        observer?.observe(video);
        nearby?.observe(video);
      },
      toggle(video) {
        const state = states.get(video);
        if (!state) return;
        if (video.paused) {
          state.userPaused = false;
          if (active && active !== video) active.pause();
          active = video;
          start(video);
        } else {
          state.userPaused = true;
          video.pause();
        }
      },
      refresh,
      get active() { return active; }
    };
    controllers.set(doc, api);
    return api;
  }
  function attachControls(video, stage, controller, label) {
    const doc = video.ownerDocument;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "video-toggle";
    const icon = doc.createElement("span");
    icon.className = "video-toggle-icon";
    icon.setAttribute("aria-hidden", "true");
    button.append(icon);
    const progress = doc.createElement("span");
    progress.className = "video-progress";
    progress.setAttribute("aria-hidden", "true");
    const bar = doc.createElement("span");
    progress.append(bar);
    const sync = () => {
      const playing = !video.paused;
      button.setAttribute("aria-label", `${label} ${playing ? "일시정지" : "재생"}`);
      stage.classList.toggle("is-playing", playing);
    };
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    video.addEventListener("timeupdate", () => {
      const duration = Number(video.duration);
      const ratio = duration > 0 ? Math.min(1, Math.max(0, video.currentTime / duration)) : 0;
      if (bar.style) bar.style.transform = `scaleX(${ratio})`;
    });
    button.addEventListener("click", () => controller.toggle(video));
    video.addEventListener("click", () => controller.toggle(video));
    const full = attachFullscreen(video, stage, controller, label);
    stage.append(button, full, progress);
    sync();
    return button;
  }
  // Fullscreen the whole stage so the play button and progress bar stay
  // available. iPhone Safari only supports native video fullscreen.
  function attachFullscreen(video, stage, controller, label) {
    const doc = video.ownerDocument;
    const full = doc.createElement("button");
    full.type = "button";
    full.className = "video-fullscreen";
    const icon = doc.createElement("span");
    icon.className = "video-fullscreen-icon";
    icon.setAttribute("aria-hidden", "true");
    full.append(icon);
    const request = stage.requestFullscreen || stage.webkitRequestFullscreen;
    const canStage = typeof request === "function" && doc.fullscreenEnabled !== false;
    const canVideo = typeof video.webkitEnterFullscreen === "function";
    full.hidden = !canStage && !canVideo;
    const current = () => doc.fullscreenElement || doc.webkitFullscreenElement || null;
    const sync = () => {
      const active = current() === stage;
      full.setAttribute("aria-label", `${label} ${active ? "전체 화면 종료" : "전체 화면"}`);
      stage.classList.toggle("is-fullscreen", active);
    };
    full.addEventListener("click", () => {
      if (current() === stage) {
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
        exit?.call(doc);
        return;
      }
      if (video.paused) controller.toggle(video);
      if (canStage) {
        const result = request.call(stage);
        if (result && typeof result.catch === "function") result.catch(() => {});
      } else if (canVideo) {
        try { video.webkitEnterFullscreen(); } catch { /* metadata not ready */ }
      }
    });
    doc.addEventListener("fullscreenchange", sync);
    doc.addEventListener("webkitfullscreenchange", sync);
    sync();
    return full;
  }
  function prepareInline(video) {
    video.controls = false;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = true;
  }
  // Static hero video: native controls stay for no-JS visitors and are
  // replaced by the shared play/pause button once the controller is ready.
  function enhance(video, label) {
    if (!video || !video.parentElement) return null;
    const controller = autoplayController(video.ownerDocument);
    prepareInline(video);
    const button = attachControls(video, video.parentElement, controller, label || video.getAttribute("aria-label") || "영상");
    controller.observe(video);
    return { video, button, controller };
  }
  // Vertical short-form feed: each scene fills the screen, plays when it is
  // mostly visible and loops until the visitor scrolls to the next scene.
  function mountFeed(section, input) {
    const items = normalizeItems(input, "videos");
    const feed = section.querySelector(".feed");
    const empty = section.querySelector(".media-empty");
    if (!feed || !items.length) return null;
    const doc = section.ownerDocument;
    const win = doc.defaultView;
    const controller = autoplayController(doc);
    const make = (tag, cls, value) => {
      const node = doc.createElement(tag);
      if (cls) node.className = cls;
      if (value) node.textContent = value;
      return node;
    };
    const pad = value => String(value).padStart(2, "0");
    const total = items.length;
    const cards = items.map((item, index) => {
      const card = make("article", "feed-item");
      card.id = `${section.id}-scene-${index + 1}`;
      card.setAttribute("aria-label", `${total}개 중 ${index + 1}: ${item.title}`);
      const stage = make("div", "feed-stage");
      const video = make("video");
      prepareInline(video);
      video.preload = "none";
      video.poster = item.poster;
      video.setAttribute("aria-label", item.title);
      if (item.captions) {
        const captions = make("track");
        captions.kind = "captions";
        captions.src = item.captions;
        captions.srclang = item.language;
        captions.label = item.captionLabel;
        captions.default = true;
        video.append(captions);
      }
      const failure = make("div", "media-failure");
      failure.hidden = true;
      failure.setAttribute("role", "status");
      failure.append(make("strong", "", "영상을 불러올 수 없습니다."), make("span", "", "잠시 후 페이지를 새로고침해 주세요."));
      video.addEventListener("error", () => {
        video.pause();
        card.classList.add("media-error");
        failure.hidden = false;
      }, { once: true });
      video.src = item.src;
      stage.append(video, failure);
      const toggle = attachControls(video, stage, controller, item.title);
      const info = make("div", "feed-info");
      const copy = make("div", "feed-copy");
      copy.append(make("span", "feed-count", `${pad(index + 1)} / ${pad(total)}`), make("h3", "feed-title", item.title));
      if (item.caption) copy.append(make("p", "feed-caption", item.caption));
      if (item.transcript) {
        const link = make("a", "feed-transcript", "영상 내용 읽기 ↗");
        link.href = item.transcript;
        copy.append(link);
      }
      info.append(copy);
      let next = null;
      if (index < total - 1) {
        next = make("button", "feed-next");
        next.type = "button";
        next.setAttribute("aria-controls", `${section.id}-scene-${index + 2}`);
        const arrow = make("span", "feed-next-arrow", "↓");
        arrow.setAttribute("aria-hidden", "true");
        next.append(make("span", "", "다음 영상"), arrow);
        next.addEventListener("click", () => go(index + 1));
        info.append(next);
      }
      card.append(stage, info);
      controller.observe(video);
      return { card, video, toggle, next };
    });
    function go(index) {
      const target = cards[clampIndex(index, total)];
      const reduced = win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      target.card.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", block: "center" });
      target.toggle.focus?.({ preventScroll: true });
    }
    feed.append(...cards.map(entry => entry.card));
    feed.hidden = false;
    if (empty) empty.hidden = true;
    section.classList.add("has-media", "has-feed");
    doc.documentElement?.classList.add("feed-snap");
    return { feed, cards, go, controller };
  }
  return { localAsset, normalizeItems, clampIndex, closestIndex, mount, mountFeed, enhance, autoplayController };
});
