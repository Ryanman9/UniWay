import { state } from "./state";
import { $ } from "./dom";
import { ROUTE_MODE } from "./config";
import {
  buildNodes,
  buildEdges,
  checkGraphConnectivity,
  buildPoiNodes,
  connectPoiToGraph,
} from "../../graph";
import { findRoute } from "../../routing";
import { buildTurnByTurn, attachStepBoundaries, buildRouteTrace } from "../../navigation";
import { fetchPlaces, fetchGraph } from "../../api";
import type { PoiCollection, GraphNode, GraphEdge } from "../../types";
import { drawPOIs, drawNavigationMarkers, enableKeepAwake } from "./mapSetup";
import { drawRoute } from "./routeDrawing";
import { collapsePickerSheet, refreshGoBtn, applyPendingDestination } from "./pickerUI";
import { renderSteps } from "./navigationUI";
import { resetSimulatorForNewRoute } from "./devSimulator";

type DataSource = "api" | "cache" | "bundled";

interface LoadedData {
  places: PoiCollection;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const CACHE_KEY = "uniway:map-data:v1";

function isUsable(data: LoadedData | null | undefined): data is LoadedData {
  return (
    !!data &&
    Array.isArray(data.places?.features) &&
    data.places.features.length > 0 &&
    Array.isArray(data.nodes) &&
    data.nodes.length > 0 &&
    Array.isArray(data.edges) &&
    data.edges.length > 0
  );
}

async function loadFromApi(): Promise<LoadedData> {
  const [places, graph] = await Promise.all([fetchPlaces(), fetchGraph()]);
  const data: LoadedData = { places, nodes: graph.nodes, edges: graph.edges };

  if (!isUsable(data)) {
    throw new Error("API returned empty or malformed data.");
  }

  return data;
}

function readCache(): LoadedData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    return isUsable(data) ? data : null;
  } catch {
    return null;
  }
}

function writeCache(data: LoadedData): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Could not cache map data:", error);
  }
}

async function loadFromBundled(): Promise<LoadedData> {
  const [paths, pois] = await Promise.all([
    fetch("./data/paths.json").then((response) => response.json()),
    fetch("./data/pois.json").then((response) => response.json()),
  ]);

  const nodes = buildNodes(paths);
  const edges = buildEdges(paths, nodes);

  return { places: pois, nodes, edges };
}

const dataBanner: Record<string, any> = {};
let isLoading = false;

export function initDataBanner(): void {
  dataBanner.el = $("data-banner");
  dataBanner.text = $("data-banner-text");
  dataBanner.retry = $("data-banner-retry");

  dataBanner.retry?.addEventListener("click", () => {
    loadData();
  });
}

function setDataBanner(message: string | null): void {
  if (!dataBanner.el) return;

  if (message === null) {
    dataBanner.el.classList.add("hidden");
    return;
  }

  dataBanner.text.textContent = message;
  dataBanner.el.classList.remove("hidden");
}

function applyData(data: LoadedData, source: DataSource): void {
  const { places, nodes, edges } = data;

  console.log(`Map data source: ${source}`);
  console.log("POIs:", places.features.length);
  console.log("Nodes:", nodes.length);
  console.log("Edges:", edges.length);

  checkGraphConnectivity(nodes, edges);

  const poiNodes = buildPoiNodes(places, nodes);
  const poiConnections = connectPoiToGraph(poiNodes, nodes);

  state.graphNodes = nodes;
  state.graphEdges = edges;
  state.graphPoiConnections = poiConnections;
  state.poisData = places;
  state.dataSource = source;

  drawPOIs(places);
  refreshGoBtn();
  applyPendingDestination();

  if (source === "api") {
    setDataBanner(null);
  } else if (source === "cache") {
    setDataBanner("Offline. Showing saved campus data.");
  } else {
    setDataBanner("Offline. Showing built-in campus data.");
  }
}

export async function loadData(): Promise<void> {
  if (isLoading) return;
  isLoading = true;

  try {
    let data: LoadedData | null = null;
    let source: DataSource | null = null;

    try {
      data = await loadFromApi();
      source = "api";
      writeCache(data);
    } catch (error) {
      console.warn("API load failed, trying cache:", error);
    }

    if (!data) {
      const cached = readCache();
      if (cached) {
        data = cached;
        source = "cache";
      }
    }

    if (!data) {
      try {
        data = await loadFromBundled();
        source = "bundled";
      } catch (error) {
        console.error("All data sources failed:", error);
        setDataBanner("Couldn't load campus data.");
        return;
      }
    }

    applyData(data, source!);
  } finally {
    isLoading = false;
  }
}

function logRouteInfo(route: any, startPoi: any, endPoi: any): void {
  console.log("========== ROUTE ==========");

  console.log(`${startPoi.properties.name} → ${endPoi.properties.name}`);

  console.log("Start vehicle node:", route.startVehicleNode);

  console.log("End vehicle node:", route.endVehicleNode);

  console.log("Total distance:", `${route.totalDistance.toFixed(2)}m`);

  console.log("========== SEGMENTS ==========");

  route.segments.forEach((segment: any, index: number) => {
    console.log(`SEGMENT ${index + 1}`);

    console.log("MODE:", segment.mode);

    console.log("PATH:", segment.path);
  });
}

export function runRoute(startPoi: any, endPoi: any): void {
  if (!state.graphNodes) {
    console.error("Graph not loaded yet.");
    return;
  }

  const route = findRoute(
    startPoi.properties.id,
    endPoi.properties.id,
    state.graphPoiConnections,
    state.graphNodes,
    state.graphEdges,
    ROUTE_MODE,
  );

  if (!route) {
    console.error("No route found.");
    return;
  }

  logRouteInfo(route, startPoi, endPoi);
  drawRoute(route);
  drawNavigationMarkers(startPoi, endPoi);
  collapsePickerSheet(startPoi.properties.name, endPoi.properties.name);

  const steps = attachStepBoundaries(
    buildTurnByTurn(route, endPoi.properties.name),
  );
  renderSteps(steps);

  state.activeRoute = route;
  state.activeSteps = steps;
  state.routeTrace = buildRouteTrace(route);
  state.hasArrived = false;

  state.offRouteStreak = 0;
  state.isRerouting = false;
  state.lastRerouteAt = 0;

  $("nav-progress")?.classList.remove("hidden", "arrived", "off-route", "rerouting");

  enableKeepAwake();

  resetSimulatorForNewRoute();
}
