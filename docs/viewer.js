(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DTMViewer = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function localImage(value) {
    if (typeof value !== "string" || !/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+(?:\?v=[a-zA-Z0-9_-]+)?$/.test(value) || value.includes("..")) return "";
    return /\.(?:avif|webp|png|jpe?g)(?:\?v=[a-zA-Z0-9_-]+)?$/i.test(value) ? value : "";
  }
  function captionText(frame) {
    const parent = frame.parentElement;
    if (!parent) return "";
    const figcaption = parent.querySelector("figcaption");
    if (figcaption && typeof figcaption.textContent === "string" && figcaption.textContent.trim()) {
      return figcaption.textContent.trim().slice(0, 240);
    }
    const heading = parent.querySelector("h3");
    const title = heading && typeof heading.textContent === "string" ? heading.textContent.trim() : "";
    const note = parent.querySelector("p");
    const desc = note && typeof note.textContent === "string" ? note.textContent.trim() : "";
    const combined = title && desc ? `${title}: ${desc}` : title || desc;
    return combined.slice(0, 240);
  }
  function mount(doc) {
    if (!doc || doc.querySelector(".lightbox")) return null;
    const frames = [...doc.querySelectorAll(".zoom-frame")];
    if (!frames.length || !doc.body) return null;
    const make = (tag, cls, value) => {
      const node = doc.createElement(tag);
      if (cls) node.className = cls;
      if (value) node.textContent = value;
      return node;
    };
    const dialog = make("dialog", "lightbox");
    const bar = make("div", "lightbox-bar");
    const count = make("span", "lightbox-count");
    const actions = make("div", "lightbox-actions");
    const prevButton = make("button", "lightbox-nav lightbox-prev", "← 이전");
    prevButton.type = "button";
    prevButton.setAttribute("aria-label", "이전 화면");
    const nextButton = make("button", "lightbox-nav lightbox-next", "다음 →");
    nextButton.type = "button";
    nextButton.setAttribute("aria-label", "다음 화면");
    const closeButton = make("button", "lightbox-close", "닫기");
    closeButton.type = "button";
    actions.append(prevButton, nextButton, closeButton);
    bar.append(count, actions);
    const figure = make("figure");
    const image = make("img");
    image.alt = "";
    const caption = make("figcaption");
    caption.id = "scene-lightbox-title";
    dialog.setAttribute("aria-labelledby", caption.id);
    figure.append(image, caption);
    dialog.append(bar, figure);
    doc.body.append(dialog);
    let opener = null;
    let currentIndex = -1;
    const validFrames = () => frames.filter(frame => {
      const source = frame.querySelector("img");
      return Boolean(source && localImage(source.getAttribute("src")));
    });
    const finish = () => {
      image.removeAttribute("src");
      currentIndex = -1;
      const back = opener;
      opener = null;
      if (back && typeof back.focus === "function") back.focus();
    };
    const close = () => {
      if (!dialog.open && !dialog.hasAttribute?.("open") && dialog.getAttribute("open") == null) return;
      if (typeof dialog.close === "function") dialog.close();
      else {
        dialog.removeAttribute("open");
        finish();
      }
    };
    function showFrame(frame, keepOpener = false) {
      const source = frame && frame.querySelector("img");
      const src = localImage(source && source.getAttribute("src"));
      if (!source || !src) return false;
      const valid = validFrames();
      currentIndex = valid.indexOf(frame);
      const total = valid.length;
      count.textContent = total > 0 && currentIndex >= 0
        ? `${String(currentIndex + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`
        : "";
      const hasMultiple = total > 1;
      prevButton.hidden = !hasMultiple;
      nextButton.hidden = !hasMultiple;
      image.setAttribute("src", src);
      image.src = src;
      image.alt = source.getAttribute("alt") || "";
      caption.textContent = captionText(frame) || image.alt;
      if (!keepOpener) opener = frame;
      if (typeof doc.querySelectorAll === "function") {
        [...doc.querySelectorAll("video")].forEach(video => {
          if (video && !video.paused && typeof video.pause === "function") video.pause();
        });
      }
      if (!dialog.open && !dialog.hasAttribute?.("open") && dialog.getAttribute("open") == null) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
        if (typeof closeButton.focus === "function") closeButton.focus();
      }
      return true;
    }
    function step(delta) {
      const valid = validFrames();
      if (valid.length < 2 || currentIndex < 0) return false;
      const nextIndex = (currentIndex + delta + valid.length) % valid.length;
      return showFrame(valid[nextIndex], true);
    }
    dialog.addEventListener("close", finish);
    closeButton.addEventListener("click", close);
    prevButton.addEventListener("click", () => step(-1));
    nextButton.addEventListener("click", () => step(1));
    dialog.addEventListener("keydown", event => {
      if (event.key === "ArrowLeft" && step(-1)) event.preventDefault();
      else if (event.key === "ArrowRight" && step(1)) event.preventDefault();
    });
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      if (typeof dialog.getBoundingClientRect === "function" && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        if (event.detail === 0) return;
        const bounds = dialog.getBoundingClientRect();
        const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom;
        if (!outside) return;
      }
      close();
    });
    function open(frame) {
      return showFrame(frame, false);
    }
    frames.forEach(frame => frame.addEventListener("click", () => open(frame)));
    return { dialog, open, close, step };
  }
  if (typeof document !== "undefined") mount(document);
  return { localImage, mount };
});
