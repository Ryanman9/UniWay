import { state } from "./state";
import { $ } from "./dom";
import {
  SIMULATOR_SPEED_MULTIPLIER,
  SIMULATOR_TICK_MS,
  SIMULATOR_DRIFT_METERS,
  SIMULATOR_DRIFT_DURATION_MS,
  FALLBACK_SPEED_MPS,
  ROUTE_MODE,
} from "./config";
import { coordinateAtDistance } from "../../navigation";
import { updateGpsPuck } from "./mapSetup";
import { updateNavigationProgress } from "./navigationUI";

const refs: Record<string, any> = {};

function offsetCoordinatePerpendicular(
  coordinate: [number, number],
  previousCoordinate: [number, number],
  offsetMeters: number,
): [number, number] {
  const refLatRad = (coordinate[1] * Math.PI) / 180;
  const R = 6371000;

  const toXY = (c: [number, number]) => ({
    x: R * ((c[0] * Math.PI) / 180) * Math.cos(refLatRad),
    y: R * ((c[1] * Math.PI) / 180),
  });

  const fromXY = (p: { x: number; y: number }): [number, number] => [
    (p.x / (R * Math.cos(refLatRad))) * (180 / Math.PI),
    (p.y / R) * (180 / Math.PI),
  ];

  const a = toXY(previousCoordinate);
  const b = toXY(coordinate);

  let dx = b.x - a.x;
  let dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= len;
  dy /= len;

  const perpX = -dy;
  const perpY = dx;

  return fromXY({
    x: b.x + perpX * offsetMeters,
    y: b.y + perpY * offsetMeters,
  });
}

export function startRouteSimulation(): void {
  if (!state.activeRoute || !state.routeTrace) return;

  state.simulatedDistance = 0;
  state.simulatorDriftUntil = 0;
  state.lastCleanSimCoordinate = null;
  refs.simulateBtn.textContent = "■ Stop simulation";
  refs.simulateDriftBtn?.classList.remove("hidden");

  const baseSpeed = FALLBACK_SPEED_MPS[ROUTE_MODE];
  const simSpeed = baseSpeed * SIMULATOR_SPEED_MULTIPLIER;
  const distancePerTick = simSpeed * (SIMULATOR_TICK_MS / 1000);

  state.simulatorIntervalId = setInterval(() => {
    state.simulatedDistance += distancePerTick;

    const cleanCoordinate = coordinateAtDistance(state.routeTrace, state.simulatedDistance);
    if (!cleanCoordinate) return;

    let coordinate = cleanCoordinate;

    if (Date.now() < state.simulatorDriftUntil && state.lastCleanSimCoordinate) {
      coordinate = offsetCoordinatePerpendicular(
        cleanCoordinate,
        state.lastCleanSimCoordinate,
        SIMULATOR_DRIFT_METERS,
      );
    }

    state.lastCleanSimCoordinate = cleanCoordinate;

    const fakeCoords = {
      longitude: coordinate[0],
      latitude: coordinate[1],
      speed: simSpeed,
      accuracy: 5,
    };

    updateGpsPuck(fakeCoords);
    updateNavigationProgress(fakeCoords);

    if (state.hasArrived || state.simulatedDistance >= state.activeRoute.totalDistance) {
      stopRouteSimulation();
    }
  }, SIMULATOR_TICK_MS);
}

export function stopRouteSimulation(): void {
  if (state.simulatorIntervalId) {
    clearInterval(state.simulatorIntervalId);
    state.simulatorIntervalId = null;
  }

  state.simulatorDriftUntil = 0;
  state.lastCleanSimCoordinate = null;

  if (refs.simulateBtn) {
    refs.simulateBtn.textContent = "▶ Simulate walk";
  }

  refs.simulateDriftBtn?.classList.add("hidden");
}

export function resetSimulatorForNewRoute(): void {
  stopRouteSimulation();
  refs.simulateBtn?.classList.remove("hidden");
}

export function hideSimulatorButton(): void {
  refs.simulateBtn?.classList.add("hidden");
}

export function initDevSimulator(): void {
  refs.simulateBtn = $("simulate-btn");
  refs.simulateDriftBtn = $("simulate-drift-btn");

  refs.simulateBtn?.addEventListener("click", () => {
    if (state.simulatorIntervalId) {
      stopRouteSimulation();
    } else {
      startRouteSimulation();
    }
  });

  refs.simulateDriftBtn?.addEventListener("click", () => {
    if (!state.simulatorIntervalId) return;
    state.simulatorDriftUntil = Date.now() + SIMULATOR_DRIFT_DURATION_MS;
  });
}