import { state } from "./state";
import { $ } from "./dom";
import { updateNavigationProgress } from "./navigationUI";

export function createMap(): void {
  state.Geolocation = window.Capacitor?.Plugins?.Geolocation ?? null;
  state.KeepAwake = window.Capacitor?.Plugins?.KeepAwake ?? null;

  state.map = new maplibregl.Map({
    container: "map",

    style: "https://tiles.openfreemap.org/styles/liberty",

    center: [78.074, 27.916],

    zoom: 17,

    bearing: 0,

    pitch: 45,

    attributionControl: true,
  });

  state.map.touchZoomRotate.enableRotation();
  state.map.touchPitch.enable();
  state.map.dragRotate.enable();
}

export function getInsertBeforeId(): string | undefined {
  if (state.firstSymbolLayerId === undefined) {
    const symbolLayer = state.map
      .getStyle()
      ?.layers?.find((l: any) => l.type === "symbol");
    state.firstSymbolLayerId = symbolLayer ? symbolLayer.id : null;
  }
  return state.firstSymbolLayerId ?? undefined;
}

export function drawPOIs(pois: any): void {
  if (state.map.getLayer("pois")) {
    state.map.removeLayer("pois");
  }

  if (state.map.getSource("pois")) {
    state.map.removeSource("pois");
  }

  state.map.addSource("pois", {
    type: "geojson",
    data: pois,
  });

  state.map.addLayer(
    {
      id: "pois",
      type: "circle",
      source: "pois",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 3, 18, 6],
        "circle-color": ["coalesce", ["get", "marker-color"], "#ff8a00"],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
    },
    getInsertBeforeId(),
  );
}

function createNavigationMarker(coordinate: any, label: string, variant = "end"): any {
  const el = document.createElement("div");

  el.className = "navigation-marker" + (variant === "start" ? " start" : "");
  el.innerHTML = `<div class="navigation-marker-dot"></div>`;

  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: true,
    offset: 18,
    className: "navigation-popup",
  }).setText(label);

  const marker = new maplibregl.Marker({
    element: el,
    anchor: "center",
  })
    .setLngLat(coordinate)
    .setPopup(popup)
    .addTo(state.map);

  return marker;
}

export function drawNavigationMarkers(startPoi: any, endPoi: any): void {
  if (state.startMarker) {
    state.startMarker.remove();
  }

  if (state.destinationMarker) {
    state.destinationMarker.remove();
  }

  state.startMarker = createNavigationMarker(
    startPoi.geometry.coordinates,
    `Start: ${startPoi.properties.name}`,
    "start",
  );

  state.destinationMarker = createNavigationMarker(
    endPoi.geometry.coordinates,
    `Destination: ${endPoi.properties.name}`,
    "end",
  );
}

function createGpsPuckElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "position-puck";
  el.innerHTML = `
    <div class="position-puck-glow"></div>
    <div class="position-puck-arrow">
      <svg viewBox="0 0 24 24" fill="#33ff00"><path d="M12 2 L20 20 L12 16 L4 20 Z"/></svg>
    </div>
  `;
  return el;
}

export function updateGpsPuck(coords: any): void {
  const lngLat = [coords.longitude, coords.latitude];

  if (!state.gpsPuckMarker) {
    state.gpsPuckMarker = new maplibregl.Marker({
      element: createGpsPuckElement(),
      anchor: "center",
    })
      .setLngLat(lngLat)
      .addTo(state.map);
  } else {
    state.gpsPuckMarker.setLngLat(lngLat);
  }
}

export async function enableKeepAwake(): Promise<void> {
  try {
    await state.KeepAwake?.keepAwake();
  } catch (error) {
    console.warn("Keep-awake not available:", error);
  }
}

export async function disableKeepAwake(): Promise<void> {
  try {
    await state.KeepAwake?.allowSleep();
  } catch (error) {
    console.warn("Keep-awake release failed:", error);
  }
}

const locationBannerRefs: { banner: any; text: any; retryBtn: any } = {
  banner: null,
  text: null,
  retryBtn: null,
};

export function initLocationBanner(): void {
  locationBannerRefs.banner = $("location-banner");
  locationBannerRefs.text = $("location-banner-text");
  locationBannerRefs.retryBtn = $("location-banner-retry");

  locationBannerRefs.retryBtn?.addEventListener("click", () => {
    initLiveLocation();
  });
}

function showLocationBanner(message: string): void {
  const { banner, text } = locationBannerRefs;
  if (!banner) return;
  if (text) text.textContent = message;
  banner.classList.remove("hidden");
}

function hideLocationBanner(): void {
  locationBannerRefs.banner?.classList.add("hidden");
}

export async function initLiveLocation(): Promise<void> {
  if (!state.Geolocation) {
    console.warn(
      "Geolocation plugin not available (not running in Capacitor native shell).",
    );
    return;
  }

  try {
    const permission = await state.Geolocation.checkPermissions();

    if (permission.location !== "granted") {
      const requested = await state.Geolocation.requestPermissions();

      if (requested.location !== "granted") {
        console.warn("Location permission denied.");
        showLocationBanner(
          "Turn on location access so we can show where you are.",
        );
        return;
      }
    }

    hideLocationBanner();

    state.gpsWatchId = await state.Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000 },
      (position: any, err: any) => {
        if (err) {
          console.error("GPS error:", err);
          showLocationBanner(
            "Lost your location. Check your signal and try again.",
          );
          return;
        }
        if (position) {
          hideLocationBanner();
          updateGpsPuck(position.coords);
          updateNavigationProgress(position.coords);
        }
      },
    );
  } catch (error) {
    console.error("Failed to start location tracking:", error);
    showLocationBanner(
      "Couldn't get your location. Check your device's location settings.",
    );
  }
}
