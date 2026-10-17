import type { PathMode } from "./types";

const FAVORITES_KEY = "uniway:favorites:v1";
const SETTINGS_KEY = "uniway:settings:v1";
const CACHE_KEYS = ["uniway:map-data:v1", "uniway:explore:v1"];

export interface Favorite {
  id: string;
  name: string;
  category: string;
}

export interface Settings {
  travelMode: PathMode;
  keepAwake: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  travelMode: "vehicle",
  keepAwake: true,
};

function emit(name: string): void {
  document.dispatchEvent(new CustomEvent(name));
}

let favoritesCache: Favorite[] | null = null;

function loadFavorites(): Favorite[] {
  if (favoritesCache) return favoritesCache;

  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    favoritesCache = Array.isArray(parsed)
      ? parsed.filter(
          (f: any) => f && typeof f.id === "string" && typeof f.name === "string",
        )
      : [];
  } catch {
    favoritesCache = [];
  }

  return favoritesCache!;
}

function saveFavorites(list: Favorite[]): void {
  favoritesCache = list;

  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  } catch (error) {
    console.warn("Could not save favorites:", error);
  }

  emit("uniway:favorites-changed");
}

export function getFavorites(): Favorite[] {
  return [...loadFavorites()];
}

export function isFavorite(id: string): boolean {
  return loadFavorites().some((f) => f.id === id);
}

export function toggleFavorite(place: Favorite): boolean {
  const list = loadFavorites();
  const exists = list.some((f) => f.id === place.id);

  saveFavorites(exists ? list.filter((f) => f.id !== place.id) : [...list, place]);

  return !exists;
}

export function removeFavorite(id: string): void {
  saveFavorites(loadFavorites().filter((f) => f.id !== id));
}

let settingsCache: Settings | null = null;

function loadSettings(): Settings {
  if (settingsCache) return settingsCache;

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    settingsCache = {
      travelMode:
        parsed?.travelMode === "pedestrian" || parsed?.travelMode === "vehicle"
          ? parsed.travelMode
          : DEFAULT_SETTINGS.travelMode,
      keepAwake:
        typeof parsed?.keepAwake === "boolean"
          ? parsed.keepAwake
          : DEFAULT_SETTINGS.keepAwake,
    };
  } catch {
    settingsCache = { ...DEFAULT_SETTINGS };
  }

  return settingsCache!;
}

export function getSettings(): Settings {
  return { ...loadSettings() };
}

export function updateSettings(patch: Partial<Settings>): void {
  settingsCache = { ...loadSettings(), ...patch };

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsCache));
  } catch (error) {
    console.warn("Could not save settings:", error);
  }

  emit("uniway:settings-changed");
}

export function clearCachedData(): void {
  CACHE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn("Could not clear cache key:", key, error);
    }
  });
}