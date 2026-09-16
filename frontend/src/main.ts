import { initHome } from "./views/home";
import { initMapView } from "./views/mapView";
import { initExplore } from "./views/explore";
import { initProfile } from "./views/profile";

type ViewName = "home" | "map" | "explore" | "profile";

const VIEW_INIT: Record<ViewName, () => void> = {
  home: initHome,
  map: initMapView,
  explore: initExplore,
  profile: initProfile,
};

const VIEW_IDS: Record<ViewName, string> = {
  home: "view-home",
  map: "view-map",
  explore: "view-explore",
  profile: "view-profile",
};

function showView(name: ViewName): void {
  (Object.keys(VIEW_IDS) as ViewName[]).forEach((key) => {
    const el = document.getElementById(VIEW_IDS[key]);
    if (!el) return;
    el.classList.toggle("hidden", key !== name);
  });

  document.querySelectorAll<HTMLElement>(".tab-bar-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });

  VIEW_INIT[name]();
}

function initTabBar(): void {
  document.querySelectorAll<HTMLElement>(".tab-bar-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view as ViewName | undefined;
      if (view) showView(view);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTabBar();
  showView("home");
});
