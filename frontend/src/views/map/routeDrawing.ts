import { state } from "./state";
import { $ } from "./dom";
import { ROUTE_COLORS, ROUTE_ERASE_MIN_DELTA_METERS } from "./config";
import { createRouteGeoJSON, createRemainingRouteGeoJSON } from "./routeGeometry";
import { getInsertBeforeId } from "./mapSetup";

export function drawRoute(route: any): void {
  state.lastRouteErasedAtDistance = null;
  const routeGeoJSON = createRouteGeoJSON(route);

  [
    "route-vehicle-glow",
    "route-vehicle",
    "route-pedestrian-glow",
    "route-pedestrian",
  ].forEach((id) => {
    if (state.map.getLayer(id)) state.map.removeLayer(id);
  });

  if (state.map.getSource("route")) {
    state.map.removeSource("route");
  }

  state.map.addSource("route", {
    type: "geojson",
    data: routeGeoJSON,
  });

  state.map.addLayer(
    {
      id: "route-vehicle-glow",
      type: "line",
      source: "route",
      filter: ["==", ["get", "mode"], "vehicle"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#0d1a03",
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 4, 18, 8.5],
        "line-opacity": 0.35,
        "line-blur": 0.4,
      },
    },
    getInsertBeforeId(),
  );

  state.map.addLayer(
    {
      id: "route-vehicle",
      type: "line",
      source: "route",
      filter: ["==", ["get", "mode"], "vehicle"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ROUTE_COLORS.vehicle,
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 2.4, 18, 5],
        "line-opacity": 0.96,
      },
    },
    getInsertBeforeId(),
  );

  state.map.addLayer(
    {
      id: "route-pedestrian-glow",
      type: "line",
      source: "route",
      filter: ["==", ["get", "mode"], "pedestrian"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#0d1a03",
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 3.2, 18, 6.5],
        "line-opacity": 0.3,
        "line-blur": 0.4,
      },
    },
    getInsertBeforeId(),
  );

  state.map.addLayer(
    {
      id: "route-pedestrian",
      type: "line",
      source: "route",
      filter: ["==", ["get", "mode"], "pedestrian"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ROUTE_COLORS.pedestrian,
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1.8, 18, 3.4],
        "line-opacity": 0.96,
        "line-dasharray": [2, 1.6],
      },
    },
    getInsertBeforeId(),
  );

  showDistanceCard(route.totalDistance);
}

export function updateRouteLineProgress(distanceAlongRoute: number): void {
  if (!state.activeRoute || !state.map.getSource("route")) return;

  if (
    state.lastRouteErasedAtDistance !== null &&
    Math.abs(distanceAlongRoute - state.lastRouteErasedAtDistance) <
      ROUTE_ERASE_MIN_DELTA_METERS
  ) {
    return;
  }

  state.lastRouteErasedAtDistance = distanceAlongRoute;

  const remainingGeoJSON = createRemainingRouteGeoJSON(
    state.activeRoute,
    distanceAlongRoute,
  );
  state.map.getSource("route").setData(remainingGeoJSON);
}

function showDistanceCard(totalDistanceMeters: number): void {
  const card = $("distance-card");
  const value = $("distance-value");

  value.textContent = (totalDistanceMeters / 1000).toFixed(2);
  card.classList.add("visible");
}
