(() => {
  "use strict";
  const media = window.DTM_MEDIA || {};
  // 로컬 공개 자산만 허용합니다. 외부 임베드와 상위 경로는 사용하지 않습니다.
  const localAsset = (value) => typeof value === "string" && /^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(value) && !value.includes("..") ? value : "";
  const textValue = (value, fallback) => typeof value === "string" && value.trim() ? value.trim() : fallback;
  function setImage(id, data, captionId) {
    const element = document.getElementById(id);
    if (!element || !data) return;
    const fallbackSrc = element.getAttribute("src");
    const fallbackAlt = element.alt;
    const caption = captionId && document.getElementById(captionId);
    const fallbackCaption = caption && caption.textContent;
    const source = localAsset(data.src);
    if (source && source !== fallbackSrc) {
      element.addEventListener("error", () => {
        element.src = fallbackSrc;
        element.alt = fallbackAlt;
        if (caption) caption.textContent = fallbackCaption;
      }, { once: true });
      element.src = source;
    }
    if (source) {
      element.alt = textValue(data.alt, fallbackAlt);
      if (caption) caption.textContent = textValue(data.caption, fallbackCaption);
    }
  }
  setImage("concept-image", media.concept, "concept-caption");
  setImage("detail-image", media.detail, "detail-caption");
  const film = media.film || {};
  setImage("film-poster", { src: film.poster, alt: film.posterAlt });
  const source = localAsset(film.src);
  if (!source) return;
  const frame = document.getElementById("film-frame");
  const placeholder = document.getElementById("film-placeholder");
  const status = document.getElementById("film-status");
  const transcript = document.getElementById("film-transcript");
  const video = document.createElement("video");
  video.controls = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "none";
  video.setAttribute("aria-label", textValue(film.title, "DigitalTwinMax 컨셉 필름"));
  video.setAttribute("aria-describedby", "film-status");
  video.poster = localAsset(film.poster) || "assets/film-poster.svg";
  video.src = source;
  document.getElementById("film-poster").addEventListener("error", () => {
    video.poster = "assets/film-poster.svg";
  }, { once: true });
  const captions = localAsset(film.captions);
  if (captions) {
    const track = document.createElement("track");
    track.kind = "captions";
    track.src = captions;
    track.srclang = textValue(film.language, "ko");
    track.label = textValue(film.captionLabel, "한국어");
    track.default = true;
    video.append(track);
  }
  const description = localAsset(film.transcript);
  if (description) {
    transcript.href = description;
    transcript.hidden = false;
  }
  video.addEventListener("error", () => {
    video.remove();
    placeholder.hidden = false;
    transcript.hidden = true;
    status.textContent = "영상을 불러올 수 없어 컨셉 포스터를 표시합니다. 영상은 준비 중입니다.";
  }, { once: true });
  placeholder.hidden = true;
  frame.append(video);
  status.textContent = "컨셉 필름 · 재생 버튼을 눌러 시작하세요. 기본 음소거 상태입니다.";
})();
