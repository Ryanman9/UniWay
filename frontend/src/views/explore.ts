import { fetchPlaces, fetchCategories } from "../api";
import type { PoiFeature, Category } from "../types";

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
  `;

  ui.search = document.getElementById("explore-search");
  ui.chips = document.getElementById("explore-chips");
  ui.status = document.getElementById("explore-status");
  ui.statusText = document.getElementById("explore-status-text");
  ui.retry = document.getElementById("explore-retry");
  ui.list = document.getElementById("explore-list");

  ui.search.addEventListener("input", () => {
    data.query = ui.search.value;
    renderList();
  });

  ui.retry.addEventListener("click", load);

  load();
}