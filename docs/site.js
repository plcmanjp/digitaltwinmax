(() => {
  "use strict";
  if (!window.DTMMedia) return;
  const media = window.DTM_MEDIA || {};
  document.querySelectorAll("video[data-autoplay]").forEach(video => window.DTMMedia.enhance(video));
  document.querySelectorAll("[data-collection]").forEach(section => {
    const type = section.dataset.collection;
    if (type === "videos" && section.querySelector(".feed")) window.DTMMedia.mountFeed(section, media.videos);
    else window.DTMMedia.mount(section, media[type], type);
  });
})();
