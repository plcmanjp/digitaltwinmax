(() => {
  "use strict";
  if (!window.DTMMedia) return;
  const media = window.DTM_MEDIA || {};
  document.querySelectorAll("[data-collection]").forEach(section => {
    const type = section.dataset.collection;
    window.DTMMedia.mount(section, media[type], type);
  });
})();
