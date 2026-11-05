(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DTMViewer = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function localImage(value) {
    if (typeof value !== "string" || !/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(value) || value.includes("..")) return "";
    return /\.(?:avif|webp|png|jpe?g)$/i.test(value) ? value : "";
  }
  function captionText(frame) {
    const parent = frame.parentElement;
    const node = parent && (parent.querySelector("figcaption") || parent.querySelector("h3"));
    const text = node && typeof node.textContent === "string" ? node.textContent.trim() : "";
    return text.slice(0, 240);
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
    const closeButton = make("button", "lightbox-close", "닫기");
    closeButton.type = "button";
    const figure = make("figure");
    const image = make("img");
    image.alt = "";
    const caption = make("figcaption");
    caption.id = "scene-lightbox-title";
    dialog.setAttribute("aria-labelledby", caption.id);
    figure.append(image, caption);
    dialog.append(closeButton, figure);
    doc.body.append(dialog);
    let opener = null;
    const finish = () => {
      image.removeAttribute("src");
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
    dialog.addEventListener("close", finish);
    closeButton.addEventListener("click", close);
    dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
    function open(frame) {
      const source = frame.querySelector("img");
      const src = localImage(source && source.getAttribute("src"));
      if (!source || !src) return false;
      image.setAttribute("src", src);
      image.src = src;
      image.alt = source.getAttribute("alt") || "";
      caption.textContent = captionText(frame) || image.alt;
      opener = frame;
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      return true;
    }
    frames.forEach(frame => frame.addEventListener("click", () => open(frame)));
    return { dialog, open, close };
  }
  if (typeof document !== "undefined") mount(document);
  return { localImage, mount };
});
