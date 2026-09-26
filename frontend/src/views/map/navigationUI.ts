import { state } from "./state";
import { $ } from "./dom";
import {
  TURN_ICONS,
  ARRIVAL_THRESHOLD_METERS,
  OFF_ROUTE_THRESHOLD_METERS,
  FALLBACK_SPEED_MPS,
  ROUTE_MODE,
  OFF_ROUTE_TRIGGER_STREAK,
  REROUTE_COOLDOWN_MS,
} from "./config";
import { formatDistance, formatDuration } from "./format";
import { projectOntoRoute, buildTurnByTurn, attachStepBoundaries, buildRouteTrace } from "../../navigation";
import { connectCoordinateToGraph } from "../../graph";
import { findRoute } from "../../routing";
import { updateRouteLineProgress, drawRoute } from "./routeDrawing";
import { disableKeepAwake } from "./mapSetup";
import { drawNavigationMarkers } from "./mapSetup";
import { collapsePickerSheet, expandPickerSheet } from "./pickerUI";
import { stopRouteSimulation, hideSimulatorButton } from "./devSimulator";

const refs: Record<string, any> = {};

export function poiNameById(poiId: string): string {
  const feature = state.poisData?.features.find((f: any) => f.properties?.id === poiId);
  return feature?.properties?.name ?? "destination";
}

export function renderSteps(steps: any[]): void {
  const card = $("steps-card");
  const list = $("steps-list");

  list.innerHTML = "";
  state.stepListItems = [];

  steps.forEach((step) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="step-icon">${TURN_ICONS[step.type] ?? "↑"}</span>
      <span class="step-label">${step.label}</span>
      <span class="step-distance">${formatDistance(step.distance)}</span>
    `;
    list.appendChild(li);
    state.stepListItems.push(li);
  });

  card.classList.add("visible");
}

function highlightActiveStep(activeStepIndex: number): void {
  state.stepListItems.forEach((li, index) => {
    li.classList.toggle("step-active", index === activeStepIndex);
  });

  const activeLi = state.stepListItems[activeStepIndex];

  if (activeLi) {
    activeLi.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function renderNavProgress({
  step,
  distanceToNextManeuver,
  remainingDistance,
  etaSeconds,
  offRoute,
}: {
  step: any;
  distanceToNextManeuver: number;
  remainingDistance: number;
  etaSeconds: number;
  offRoute: boolean;
}): void {
  refs.navProgressIconEl.textContent = TURN_ICONS[step.type] ?? "↑";
  refs.navProgressInstructionEl.textContent = step.label;
  refs.navProgressDistanceEl.textContent = formatDistance(distanceToNextManeuver);

  refs.navProgressRemainingEl.textContent = `${formatDistance(remainingDistance)} left`;
  refs.navProgressEtaEl.textContent = formatDuration(etaSeconds);

  refs.navProgressEl.classList.toggle("off-route", offRoute);
}

function showArrivalState(destinationName: string): void {
  refs.navProgressEl.classList.add("arrived");
  refs.navProgressIconEl.textContent = "●";
  refs.navProgressInstructionEl.textContent = `You've arrived at ${destinationName}`;
  refs.navProgressDistanceEl.textContent = "";
  refs.navProgressRemainingEl.textContent = "";
  refs.navProgressEtaEl.textContent = "";
}

export function endNavigation(): void {
  state.activeRoute = null;
  state.activeSteps = null;
  state.routeTrace = null;
  state.hasArrived = false;
  state.lastRouteErasedAtDistance = null;

  state.offRouteStreak = 0;
  state.isRerouting = false;

  refs.navProgressEl.classList.add("hidden");
  refs.navProgressEl.classList.remove("arrived", "off-route", "rerouting");

  $("steps-card")?.classList.remove("visible");
  expandPickerSheet();

  disableKeepAwake();

  stopRouteSimulation();
  hideSimulatorButton();
}

export function updateNavigationProgress(coords: any): void {
  if (!state.activeRoute || !state.routeTrace || !state.activeSteps) {
    return;
  }

  const projection = projectOntoRoute(state.routeTrace, [
    coords.longitude,
    coords.latitude,
  ]);

  if (!projection) return;

  updateRouteLineProgress(projection.distanceAlongRoute);

  const remainingDistance = Math.max(
    state.activeRoute.totalDistance - projection.distanceAlongRoute,
    0,
  );

  let nextStepIndex = state.activeSteps.findIndex(
    (step: any) => step.distanceFromStart > projection.distanceAlongRoute,
  );

  if (nextStepIndex === -1) {
    nextStepIndex = state.activeSteps.length - 1;
  }

  const nextStep = state.activeSteps[nextStepIndex];
  const distanceToNextManeuver = Math.max(
    nextStep.distanceFromStart - projection.distanceAlongRoute,
    0,
  );

  const speed =
    coords.speed && coords.speed > 0.3
      ? coords.speed
      : FALLBACK_SPEED_MPS[ROUTE_MODE];
  const etaSeconds = remainingDistance / speed;

  const offRoute = projection.offRouteDistance > OFF_ROUTE_THRESHOLD_METERS;

  if (!state.hasArrived) {
    renderNavProgress({
      step: nextStep,
      distanceToNextManeuver,
      remainingDistance,
      etaSeconds,
      offRoute,
    });

    highlightActiveStep(nextStepIndex);
  }

  if (!state.hasArrived && remainingDistance <= ARRIVAL_THRESHOLD_METERS) {
    state.hasArrived = true;
    showArrivalState(
      state.activeRoute.endPoi ? poiNameById(state.activeRoute.endPoi) : "destination",
    );
    disableKeepAwake();
  }

  if (!state.hasArrived) {
    state.offRouteStreak = offRoute ? state.offRouteStreak + 1 : 0;

    const cooldownElapsed = Date.now() - state.lastRerouteAt > REROUTE_COOLDOWN_MS;

    if (
      state.offRouteStreak >= OFF_ROUTE_TRIGGER_STREAK &&
      cooldownElapsed &&
      !state.isRerouting
    ) {
      triggerReroute(coords);
    }
  }
}

function triggerReroute(coords: any): void {
  if (!state.activeRoute || state.isRerouting) return;

  state.isRerouting = true;
  state.offRouteStreak = 0;
  state.lastRerouteAt = Date.now();

  refs.navProgressEl.classList.add("rerouting");
  refs.navProgressInstructionEl.textContent = "Recalculating route…";
  refs.navProgressDistanceEl.textContent = "";

  const currentCoordinate: [number, number] = [coords.longitude, coords.latitude];
  const destinationPoiId = state.activeRoute.endPoi;

  const currentConnection = connectCoordinateToGraph(
    currentCoordinate,
    state.graphNodes,
  );

  if (!currentConnection) {
    console.error(
      "Reroute failed: couldn't connect current position to the graph.",
    );
    state.isRerouting = false;
    refs.navProgressEl.classList.remove("rerouting");
    return;
  }

  const CURRENT_LOCATION_ID = "__current_location__";

  const poiConnectionsWithCurrent = [
    ...state.graphPoiConnections,
    {
      poiId: CURRENT_LOCATION_ID,
      poiName: "Current location",
      nodeId: currentConnection.nodeId,
      distance: currentConnection.distance,
    },
  ];

  const newRoute = findRoute(
    CURRENT_LOCATION_ID,
    destinationPoiId,
    poiConnectionsWithCurrent,
    state.graphNodes,
    state.graphEdges,
    state.activeRoute.mode,
  );

  state.isRerouting = false;
  refs.navProgressEl.classList.remove("rerouting");

  if (!newRoute) {
    console.error("Reroute failed: no route found from the current position.");
    return;
  }

  newRoute.endPoi = destinationPoiId;

  const destinationPoi = state.poisData?.features.find(
    (f: any) => f.properties?.id === destinationPoiId,
  );

  const syntheticStart = {
    geometry: { type: "Point", coordinates: currentCoordinate },
    properties: { name: "Current location" },
  };

  drawRoute(newRoute);

  if (destinationPoi) {
    drawNavigationMarkers(syntheticStart, destinationPoi);
    collapsePickerSheet("Current location", destinationPoi.properties.name);
  }

  const newSteps = attachStepBoundaries(
    buildTurnByTurn(
      newRoute,
      destinationPoi?.properties?.name ?? "destination",
    ),
  );

  renderSteps(newSteps);

  state.activeRoute = newRoute;
  state.activeSteps = newSteps;
  state.routeTrace = buildRouteTrace(newRoute);
  state.hasArrived = false;

  updateNavigationProgress(coords);
}

export function initNavigationUI(): void {
  refs.navProgressEl = $("nav-progress");
  refs.navProgressIconEl = $("nav-progress-icon");
  refs.navProgressInstructionEl = $("nav-progress-instruction");
  refs.navProgressDistanceEl = $("nav-progress-distance");
  refs.navProgressRemainingEl = $("nav-progress-remaining");
  refs.navProgressEtaEl = $("nav-progress-eta");
  refs.navProgressDoneBtn = $("nav-progress-done");

  refs.navProgressDoneBtn?.addEventListener("click", endNavigation);
}
