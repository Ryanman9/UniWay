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
import { drawPOIs, drawNavigationMarkers, enableKeepAwake } from "./mapSetup";
import { drawRoute } from "./routeDrawing";
import { collapsePickerSheet } from "./pickerUI";
import { renderSteps } from "./navigationUI";
import { resetSimulatorForNewRoute } from "./devSimulator";

export async function loadData(): Promise<void> {
  try {
    const [paths, pois] = await Promise.all([
      fetch("./data/paths.json").then((response) => response.json()),

      fetch("./data/pois.json").then((response) => response.json()),
    ]);

    console.log("Paths loaded:", paths.features.length);

    console.log("POIs loaded:", pois.features.length);

    const nodes = buildNodes(paths);

    const edges = buildEdges(paths, nodes);

    console.log("Nodes:", nodes.length);

    console.log("Edges:", edges.length);

    checkGraphConnectivity(nodes, edges);

    const poiNodes = buildPoiNodes(pois, nodes);

    const poiConnections = connectPoiToGraph(poiNodes, nodes);

    console.log("POI connections:", poiConnections);

    state.graphNodes = nodes;
    state.graphEdges = edges;
    state.graphPoiConnections = poiConnections;
    state.poisData = pois;

    drawPOIs(pois);
  } catch (error) {
    console.error("Application error:", error);
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
