(() => {
  "use strict";
  const api = window.DTMReleases;
  const panel = document.getElementById("trial-panel");
  if (!api || !panel) return;
  const status = document.getElementById("trial-status");
  const message = document.getElementById("trial-message");
  const detail = document.getElementById("trial-detail");
  const retry = document.getElementById("trial-retry");
  let loading = false;
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const sizeLabel = bytes => bytes < 1048576 ? `${Math.ceil(bytes / 1024)} KiB` : `${(bytes / 1048576).toFixed(1)} MiB`;

  function showRelease(result) {
    const meta = make("div", "trial-meta");
    meta.append(make("span", "trial-version", `v${result.version}`));
    meta.append(make("span", "trial-badge", result.prerelease ? "사전 공개 체험판" : "공개 체험판"));
    const date = make("time", "trial-date", new Date(result.publishedAt).toLocaleDateString("ko-KR", { timeZone: "UTC" }));
    date.dateTime = result.publishedAt;
    meta.append(date);
    detail.append(meta);
    if (result.assets.length) {
      const list = make("ul", "trial-files");
      for (const asset of result.assets) {
        const item = make("li", "trial-file");
        const info = make("div", "trial-file-info");
        const kind = asset.format === "zip" ? "압축 패키지" : "설치 파일";
        info.append(make("span", "trial-file-platform", `Windows ${asset.arch} · ${kind} ${asset.format.toUpperCase()} · ${sizeLabel(asset.size)}`));
        info.append(make("span", "trial-file-name", asset.name));
        const link = make("a", "trial-download", "다운로드 ↓");
        link.href = asset.url;
        link.setAttribute("aria-label", `${asset.name} 다운로드, GitHub Releases 파일`);
        item.append(info, link);
        list.append(item);
      }
      detail.append(list);
    }
    const notes = make("details", "trial-notes");
    notes.append(make("summary", "", "릴리스 노트"));
    const excerpt = result.notes.trim();
    notes.append(make("p", "trial-notes-text", excerpt ? excerpt.slice(0, 1600) : "별도로 작성된 릴리스 노트가 없습니다. 공식 Release에서 설치 및 이용 안내를 확인하세요."));
    if (excerpt.length > 1600) notes.append(make("p", "trial-note-limit", "노트의 앞부분만 표시합니다. 전체 내용은 공식 Release에서 확인하세요."));
    detail.append(notes);
    const link = make("a", "text-link trial-release-link", "공식 Release와 전체 노트 ↗ (새 탭)");
    link.href = result.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    detail.append(link);
    detail.hidden = false;
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    // Keep keyboard focus while preventing duplicate requests during loading.
    retry.setAttribute("aria-disabled", "true");
    panel.setAttribute("aria-busy", "true");
    detail.replaceChildren();
    detail.hidden = true;
    status.textContent = "공개 상태 확인 중";
    message.textContent = "GitHub Releases에서 체험판 정보를 확인하고 있습니다.";
    try {
      const result = await api.loadTrial();
      if (result.state === "empty") {
        status.textContent = "체험판 준비 중";
        message.textContent = "아직 공개된 체험판이 없습니다. 준비가 되면 이곳에서 다운로드 파일과 이용 안내를 확인할 수 있습니다.";
      } else {
        status.textContent = result.state === "available" ? "체험판 다운로드" : "배포 파일 준비 중";
        message.textContent = result.state === "available"
          ? "설치 전 릴리스 노트에서 지원 환경과 이용 조건을 확인하고, 사용 중인 Windows에 맞는 파일을 선택하세요."
          : "체험판 소식은 공개되었지만 다운로드할 수 있는 Windows 배포 파일은 아직 없습니다. 공식 Release의 안내를 확인하세요.";
        showRelease(result);
      }
    } catch (error) {
      status.textContent = "현재 상태를 확인할 수 없습니다";
      const messages = {
        "rate-limit": "GitHub의 조회가 일시적으로 제한되었습니다. 잠시 후 다시 확인하거나 공식 Releases 목록을 이용하세요.",
        timeout: "GitHub의 응답이 지연되고 있습니다. 잠시 후 다시 확인하거나 공식 Releases 목록을 이용하세요.",
        network: "네트워크 연결을 확인한 뒤 다시 시도해 주세요. 공식 Releases 목록에서도 공개 여부를 확인할 수 있습니다."
      };
      message.textContent = messages[error.code] || "다운로드 정보를 안전하게 확인하지 못했습니다. 공식 Releases 목록에서 공개 여부와 파일을 확인해 주세요.";
    } finally {
      panel.setAttribute("aria-busy", "false");
      loading = false;
      retry.removeAttribute("aria-disabled");
    }
  }
  retry.hidden = false;
  retry.addEventListener("click", refresh);
  refresh();
})();
