(() => {
  "use strict";
  function openTargetDetails(hash) {
    if (!hash || hash.length < 2) return;
    const target = document.getElementById(hash.slice(1));
    if (target && target.tagName === "DETAILS") target.open = true;
  }
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", () => openTargetDetails(link.getAttribute("href")));
  });
  window.addEventListener("hashchange", () => openTargetDetails(window.location.hash));
  openTargetDetails(window.location.hash);

  // Desktop scrollspy for sticky navigation
  const navLinks = [...document.querySelectorAll('.site-header nav a[href^="#"], #header-trial-link')];
  const trackedSections = navLinks
    .map(link => ({ link, id: link.getAttribute("href").slice(1), section: document.getElementById(link.getAttribute("href").slice(1)) }))
    .filter(item => item.section);
  if (trackedSections.length && window.IntersectionObserver) {
    const visibleRatios = new Map();
    const updateActiveNav = () => {
      let bestId = "";
      let bestRatio = 0;
      trackedSections.forEach(({ id }) => {
        const ratio = visibleRatios.get(id) || 0;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestId = id;
        }
      });
      trackedSections.forEach(({ link, id }) => {
        if (id === bestId && bestRatio > 0) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };
    const spy = new IntersectionObserver(entries => {
      entries.forEach(entry => visibleRatios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0));
      updateActiveNav();
    }, { rootMargin: "-20% 0px -45% 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75] });
    trackedSections.forEach(({ section }) => spy.observe(section));
  }

  // Interactive 3-step showcase tabs in #features (progressive enhancement)
  const showcase = document.querySelector(".step-showcase");
  if (showcase) {
    const tabs = [...showcase.querySelectorAll('[role="tab"]')];
    const panels = [...showcase.querySelectorAll('[role="tabpanel"]')];
    if (tabs.length && tabs.length === panels.length) {
      showcase.classList.add("is-tabbed");
      const activate = (index, focusTab = false) => {
        tabs.forEach((tab, i) => {
          const active = i === index;
          tab.setAttribute("aria-selected", String(active));
          tab.tabIndex = active ? 0 : -1;
          panels[i].hidden = !active;
        });
        if (focusTab) tabs[index].focus();
      };
      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => activate(index, false));
        tab.addEventListener("keydown", event => {
          const map = {
            ArrowLeft: (index - 1 + tabs.length) % tabs.length,
            ArrowRight: (index + 1) % tabs.length,
            Home: 0,
            End: tabs.length - 1
          };
          if (map[event.key] === undefined) return;
          event.preventDefault();
          activate(map[event.key], true);
        });
      });
      activate(0, false);
    }
    showcase.querySelectorAll("[data-usage-seek]").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetTime = btn.getAttribute("data-usage-seek");
        const usage = document.querySelector(".usage-overview");
        const chapter = usage?.querySelector(`.video-chapters button[data-seek="${targetTime}"]`);
        if (usage) {
          const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
          usage.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
        }
        chapter?.click();
      });
    });
  }

  // Subtle reveal animation for cards and sections when motion is allowed
  const revealItems = [...document.querySelectorAll(".reveal-item")];
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (revealItems.length && window.IntersectionObserver && !reducedMotion) {
    document.documentElement.classList.add("reveal-ready");
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealItems.forEach(el => revealObserver.observe(el));
  }

  // Mobile bottom CTA dock: show only after leaving hero and hide while viewing #trial
  const mobileDock = document.getElementById("mobile-dock");
  const mobileDockLink = document.getElementById("mobile-dock-link");
  const heroSection = document.querySelector(".hero-section");
  const trialSection = document.getElementById("trial");
  if (mobileDock && heroSection && trialSection && window.IntersectionObserver) {
    let heroVisible = true;
    let trialVisible = false;
    const syncDock = () => {
      const show = !heroVisible && !trialVisible;
      mobileDock.classList.toggle("is-visible", show);
      mobileDock.setAttribute("aria-hidden", String(!show));
      if (mobileDockLink) mobileDockLink.tabIndex = show ? 0 : -1;
    };
    const dockObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.target === heroSection) heroVisible = entry.isIntersecting;
        else if (entry.target === trialSection) trialVisible = entry.isIntersecting;
      });
      syncDock();
    }, { threshold: 0.08 });
    dockObserver.observe(heroSection);
    dockObserver.observe(trialSection);
    syncDock();
  }

  if (!window.DTMMedia) return;
  const media = window.DTM_MEDIA || {};
  document.querySelectorAll("video[data-autoplay]").forEach(video => window.DTMMedia.enhance(video));
  document.querySelectorAll("[data-collection]").forEach(section => {
    const type = section.dataset.collection;
    if (type === "videos" && section.querySelector(".feed")) window.DTMMedia.mountFeed(section, media.videos);
    else window.DTMMedia.mount(section, media[type], type);
  });
})();
