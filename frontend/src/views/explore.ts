import { fetchPlaces, fetchCategories, fetchPlace, assetUrl } from "../api";
import type { PoiFeature, Category, PlaceDetails } from "../types";

const CACHE_KEY = "uniway:explore:v1";

let exploreInitialized = false;
let isLoading = false;

const ui: Record<string, any> = {};

const data = {
  places: [] as PoiFeature[],
  categories: [] as Category[],
  activeType: null as string | null,
  query: "",
};

function readCache(): { places: PoiFeature[]; categories: Category[] } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cached = JSON.parse(raw);
    if (!Array.isArray(cached?.places) || cached.places.length === 0) return null;

    return {
      places: cached.places,
      categories: Array.isArray(cached.categories) ? cached.categories : [],
    };
  } catch {
    return null;
  }
}

function writeCache(): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ places: data.places, categories: data.categories }),
    );
  } catch (error) {
    console.warn("Could not cache explore data:", error);
  }
}

function setStatus(message: string | null, showRetry = false): void {
  if (message === null) {
    ui.status.classList.add("hidden");
    return;
  }

  ui.statusText.textContent = message;
  ui.retry.classList.toggle("hidden", !showRetry);
  ui.status.classList.remove("hidden");
}

function categoryLabel(type: string): string {
  return data.categories.find((c) => c.id === type)?.label ?? type;
}

function renderChips(): void {
  ui.chips.innerHTML = "";

  const make = (label: string, type: string | null) => {
    const chip = document.createElement("button");
    chip.className = "explore-chip" + (data.activeType === type ? " active" : "");
    chip.textContent = label;
    chip.addEventListener("click", () => {
      data.activeType = type;
      renderChips();
      renderList();
    });
    ui.chips.appendChild(chip);
  };

  make("All", null);
  data.categories.forEach((c) => make(c.label, c.id));
}

function renderList(): void {
  const q = data.query.trim().toLowerCase();

  const matches = data.places.filter((f) => {
    if (data.activeType && f.properties.type !== data.activeType) return false;
    return !q || f.properties.name.toLowerCase().includes(q);
  });

  ui.list.innerHTML = "";

  if (matches.length === 0) {
    const empty = document.createElement("li");
    empty.className = "explore-empty";
    empty.textContent = data.places.length === 0 ? "No places loaded." : "No places found.";
    ui.list.appendChild(empty);
    return;
  }

  matches.forEach((feature) => {
    const li = document.createElement("li");
    li.className = "explore-item";
    li.dataset.placeId = feature.properties.id;

    const dot = document.createElement("span");
    dot.className = "explore-item-dot";
    dot.style.background = feature.properties["marker-color"] ?? "#ff8a00";

    const text = document.createElement("div");

    const name = document.createElement("div");
    name.className = "explore-item-name";
    name.textContent = feature.properties.name;

    const type = document.createElement("div");
    type.className = "explore-item-type";
    type.textContent = categoryLabel(feature.properties.type);

    text.append(name, type);
    li.append(dot, text);
    ui.list.appendChild(li);
  });
}

let detailRequestId = 0;

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(title: string, content: HTMLElement): HTMLElement {
  const wrap = el("section", "detail-section");
  wrap.append(el("h3", "detail-section-title", title), content);
  return wrap;
}

function renderDetail(
  feature: PoiFeature,
  details: PlaceDetails | null,
  note: string | null,
): void {
  const body = ui.detailBody;
  body.innerHTML = "";

  const { name, type } = feature.properties;
  body.append(el("h2", "detail-name", name), el("div", "detail-type", categoryLabel(type)));

  if (note) body.append(el("div", "detail-note", note));

  if (details?.images?.length) {
    const gallery = el("div", "detail-gallery");

    details.images.forEach((src) => {
      const img = document.createElement("img");
      img.src = assetUrl(src);
      img.alt = name;
      img.loading = "lazy";
      img.addEventListener("error", () => img.remove());
      gallery.appendChild(img);
    });

    body.append(gallery);
  }

  const hasContent =
    !!details &&
    !!(
      details.description ||
      details.history ||
      details.hours ||
      details.relatedPeople?.length
    );

  if (!hasContent) {
    if (!note) body.append(el("div", "detail-empty", "No details yet."));
    return;
  }

  if (details!.description) {
    body.append(section("About", el("p", "detail-text", details!.description)));
  }

  if (details!.hours) {
    body.append(section("Hours", el("p", "detail-text", details!.hours)));
  }

  if (details!.history) {
    body.append(section("History", el("p", "detail-text", details!.history)));
  }

  if (details!.relatedPeople?.length) {
    const list = el("ul", "detail-people");

    details!.relatedPeople.forEach((person) => {
      const li = el("li");
      li.append(el("strong", undefined, person.name), el("span", undefined, ` · ${person.relation}`));
      list.appendChild(li);
    });

    body.append(section("Related people", list));
  }
}

async function openDetail(placeId: string): Promise<void> {
  const feature = data.places.find((f) => f.properties.id === placeId);
  if (!feature) return;

  const requestId = ++detailRequestId;

  ui.detail.classList.remove("hidden");
  ui.detailBody.scrollTop = 0;
  renderDetail(feature, null, "Loading…");

  try {
    const result = await fetchPlace(placeId);
    if (requestId !== detailRequestId) return;
    renderDetail(feature, result.details, null);
  } catch (error) {
    console.warn("Place details failed:", error);
    if (requestId !== detailRequestId) return;
    renderDetail(feature, null, "Details unavailable offline.");
  }
}

function closeDetail(): void {
  detailRequestId++;
  ui.detail.classList.add("hidden");
}

async function load(): Promise<void> {
  if (isLoading) return;
  isLoading = true;

  setStatus("Loading places…");

  try {
    const [places, categories] = await Promise.all([fetchPlaces(), fetchCategories()]);

    data.places = places.features;
    data.categories = categories;
    writeCache();
    setStatus(null);
  } catch (error) {
    console.warn("Explore load failed, trying cache:", error);

    const cached = readCache();

    if (cached) {
      data.places = cached.places;
      data.categories = cached.categories;
      setStatus("Offline. Showing saved places.", true);
    } else {
      setStatus("Couldn't load places.", true);
    }
  } finally {
    isLoading = false;
  }

  renderChips();
  renderList();
}

export function initExplore(): void {
  if (exploreInitialized) return;
  exploreInitialized = true;

  const container = document.getElementById("view-explore");
  if (!container) return;

  container.innerHTML = `
    <div class="explore">
      <div class="explore-header">
        <h1>Explore</h1>
        <input id="explore-search" type="search" placeholder="Search places" autocomplete="off" />
        <div id="explore-chips" class="explore-chips"></div>
      </div>
      <div id="explore-status" class="explore-status hidden">
        <span id="explore-status-text"></span>
        <button id="explore-retry" class="hidden">Retry</button>
      </div>
      <ul id="explore-list" class="explore-list"></ul>
    </div>
    <div id="explore-detail" class="explore-detail hidden">
      <div class="explore-detail-bar">
        <button id="explore-detail-back" aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
      </div>
      <div id="explore-detail-body" class="explore-detail-body"></div>
    </div>
  `;

  ui.search = document.getElementById("explore-search");
  ui.chips = document.getElementById("explore-chips");
  ui.status = document.getElementById("explore-status");
  ui.statusText = document.getElementById("explore-status-text");
  ui.retry = document.getElementById("explore-retry");
  ui.list = document.getElementById("explore-list");

  ui.detail = document.getElementById("explore-detail");
  ui.detailBody = document.getElementById("explore-detail-body");

  document.getElementById("explore-detail-back")?.addEventListener("click", closeDetail);

  ui.list.addEventListener("click", (e: Event) => {
    const item = (e.target as HTMLElement).closest(".explore-item") as HTMLElement | null;
    if (item?.dataset.placeId) openDetail(item.dataset.placeId);
  });

  ui.search.addEventListener("input", () => {
    data.query = ui.search.value;
    renderList();
  });

  ui.retry.addEventListener("click", load);

  load();
}