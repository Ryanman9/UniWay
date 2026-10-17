import {
  getFavorites,
  removeFavorite,
  getSettings,
  updateSettings,
  clearCachedData,
} from "../storage";
import type { PathMode } from "../types";

let profileInitialized = false;
let root: HTMLElement | null = null;
let dataNote = "";

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(title: string, content: HTMLElement): HTMLElement {
  const wrap = el("section", "profile-section");
  wrap.append(el("h2", "profile-section-title", title), content);
  return wrap;
}

function renderFavorites(): HTMLElement {
  const favorites = getFavorites();
  const card = el("div", "profile-card");

  if (favorites.length === 0) {
    card.append(
      el("div", "profile-empty", "No saved places yet. Tap the heart on a place in Explore to save it."),
    );
    return card;
  }

  favorites.forEach((fav) => {
    const row = el("div", "fav-item");
    row.dataset.placeId = fav.id;

    const text = el("div", "fav-text");
    text.append(el("div", "fav-name", fav.name), el("div", "fav-category", fav.category));

    const go = el("button", "fav-go", "Navigate");
    go.dataset.action = "navigate";

    const remove = el("button", "fav-remove");
    remove.dataset.action = "remove";
    remove.setAttribute("aria-label", `Remove ${fav.name} from saved places`);
    remove.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>';

    row.append(text, go, remove);
    card.append(row);
  });

  return card;
}

function renderSettings(): HTMLElement {
  const settings = getSettings();
  const card = el("div", "profile-card");

  const modeRow = el("div", "setting-row");
  const modeText = el("div", "setting-text");
  modeText.append(
    el("div", "setting-label", "Travel mode"),
    el("div", "setting-hint", "Applies to the next route you start."),
  );

  const segmented = el("div", "segmented");
  ([
    ["vehicle", "Vehicle"],
    ["pedestrian", "Walking"],
  ] as [PathMode, string][]).forEach(([mode, label]) => {
    const btn = el("button", "segmented-btn" + (settings.travelMode === mode ? " active" : ""), label);
    btn.dataset.action = "mode";
    btn.dataset.mode = mode;
    segmented.append(btn);
  });

  modeRow.append(modeText, segmented);

  const awakeRow = el("div", "setting-row");
  const awakeText = el("div", "setting-text");
  awakeText.append(el("div", "setting-label", "Keep screen on while navigating"));

  const toggle = el("button", "switch" + (settings.keepAwake ? " on" : ""));
  toggle.dataset.action = "keep-awake";
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("aria-checked", String(settings.keepAwake));
  toggle.setAttribute("aria-label", "Keep screen on while navigating");
  toggle.append(el("span", "switch-thumb"));

  awakeRow.append(awakeText, toggle);

  card.append(modeRow, awakeRow);
  return card;
}

function renderData(): HTMLElement {
  const card = el("div", "profile-card");

  const row = el("div", "setting-row");
  const text = el("div", "setting-text");
  text.append(
    el("div", "setting-label", "Downloaded campus data"),
    el(
      "div",
      "setting-hint",
      dataNote || "Clear this if places or paths look out of date. Saved places are kept.",
    ),
  );

  const clear = el("button", "profile-btn", "Clear");
  clear.dataset.action = "clear-cache";

  row.append(text, clear);
  card.append(row);
  return card;
}

function render(): void {
  if (!root) return;

  root.innerHTML = "";

  const page = el("div", "profile");
  const header = el("div", "profile-header");
  header.append(el("h1", undefined, "Profile"));

  page.append(
    header,
    section("Saved places", renderFavorites()),
    section("Navigation", renderSettings()),
    section("Data", renderData()),
  );

  root.append(page);
}

function handleClick(e: Event): void {
  const target = (e.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
  if (!target) return;

  const placeId = (target.closest("[data-place-id]") as HTMLElement | null)?.dataset.placeId;

  switch (target.dataset.action) {
    case "navigate":
      if (placeId) {
        document.dispatchEvent(new CustomEvent("uniway:navigate-to", { detail: placeId }));
      }
      break;

    case "remove":
      if (placeId) removeFavorite(placeId);
      break;

    case "mode":
      updateSettings({ travelMode: target.dataset.mode as PathMode });
      break;

    case "keep-awake":
      updateSettings({ keepAwake: !getSettings().keepAwake });
      break;

    case "clear-cache":
      clearCachedData();
      dataNote = "Cleared. Fresh data loads next time you're online.";
      render();
      break;
  }
}

export function initProfile(): void {
  if (profileInitialized) return;
  profileInitialized = true;

  root = document.getElementById("view-profile");
  if (!root) return;

  root.addEventListener("click", handleClick);
  document.addEventListener("uniway:favorites-changed", render);
  document.addEventListener("uniway:settings-changed", render);

  render();
}