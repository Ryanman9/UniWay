import { calculateDistance } from "./graph";
import type { RouteResult } from "./routing";

type Coordinate = [number, number];

interface TurnStep {
  type: string;
  label: string;
  distance: number;
  coordinate: Coordinate;
}

interface StepWithBoundary extends TurnStep {
  distanceFromStart: number;
}

interface TracePoint {
  coordinate: Coordinate;
  distanceFromStart: number;
}

interface ProjectionResult {
  offRouteDistance: number;
  distanceAlongRoute: number;
  segmentIndex: number;
}

function bearing(a: Coordinate, b: Coordinate): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLon = toRad(b[0] - a[0]);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function angleDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

function classifyTurn(delta: number): { type: string; label: string } {
  const abs = Math.abs(delta);

  if (abs < 20) return { type: "straight", label: "Continue straight" };
  if (abs < 60) {
    return delta > 0
      ? { type: "slight_right", label: "Slight right" }
      : { type: "slight_left", label: "Slight left" };
  }
  if (abs < 150) {
    return delta > 0
      ? { type: "right", label: "Turn right" }
      : { type: "left", label: "Turn left" };
  }
  return { type: "u_turn", label: "Make a U-turn" };
}

function flattenRouteCoordinates(route: RouteResult): Coordinate[] {
  const coords: Coordinate[] = [];

  route.segments.forEach((segment) => {
    if (!segment.edges) return;

    segment.edges.forEach((edge) => {
      const edgeCoords = (edge as unknown as { coordinates?: Coordinate[] })
        .coordinates;
      if (!edgeCoords || edgeCoords.length < 2) return;

      edgeCoords.forEach((c) => {
        const last = coords[coords.length - 1];
        if (last && last[0] === c[0] && last[1] === c[1]) return;
        coords.push(c);
      });
    });
  });

  return coords;
}

const MIN_VERTEX_DISTANCE = 3;

function buildTurnByTurn(
  route: RouteResult,
  destinationName = "destination"
): TurnStep[] {
  const coords = flattenRouteCoordinates(route);

  if (coords.length < 2) {
    return [
      {
        type: "arrive",
        label: `Arrive at ${destinationName}`,
        distance: 0,
        coordinate: coords[0],
      },
    ];
  }

  const pts: Coordinate[] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    if (calculateDistance(pts[pts.length - 1], coords[i]) >= MIN_VERTEX_DISTANCE) {
      pts.push(coords[i]);
    }
  }
  if (pts.length < 2) pts.push(coords[coords.length - 1]);

  const bearings: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    bearings.push(bearing(pts[i], pts[i + 1]));
  }

  const steps: TurnStep[] = [
    { type: "depart", label: "Head out", distance: 0, coordinate: pts[0] },
  ];

  let segStartIdx = 0;
  for (let i = 1; i < bearings.length; i++) {
    const delta = angleDelta(bearings[i - 1], bearings[i]);
    const turn = classifyTurn(delta);

    if (turn.type !== "straight") {

      let dist = 0;
      for (let j = segStartIdx; j < i; j++) {
        dist += calculateDistance(pts[j], pts[j + 1]);
      }
      steps[steps.length - 1].distance = dist;

      steps.push({ type: turn.type, label: turn.label, distance: 0, coordinate: pts[i] });
      segStartIdx = i;
    }
  }

  let finalDist = 0;
  for (let j = segStartIdx; j < pts.length - 1; j++) {
    finalDist += calculateDistance(pts[j], pts[j + 1]);
  }
  steps[steps.length - 1].distance = finalDist;

  steps.push({
    type: "arrive",
    label: `Arrive at ${destinationName}`,
    distance: 0,
    coordinate: pts[pts.length - 1],
  });

  return steps;
}

function attachStepBoundaries(steps: TurnStep[]): StepWithBoundary[] {
  let cumulative = 0;

  return steps.map((step) => {
    const stepWithBoundary: StepWithBoundary = { ...step, distanceFromStart: cumulative };
    cumulative += step.distance;
    return stepWithBoundary;
  });
}

function buildRouteTrace(route: RouteResult): TracePoint[] {
  const coords = flattenRouteCoordinates(route);

  const trace: TracePoint[] = [];
  let cumulative = 0;

  for (let i = 0; i < coords.length; i++) {
    if (i > 0) {
      cumulative += calculateDistance(coords[i - 1], coords[i]);
    }

    trace.push({ coordinate: coords[i], distanceFromStart: cumulative });
  }

  return trace;
}

function projectOntoRoute(
  trace: TracePoint[],
  userCoordinate: Coordinate
): ProjectionResult | null {
  if (!trace || trace.length < 2) {
    return null;
  }

  const refLat = trace[Math.floor(trace.length / 2)].coordinate[1];
  const refLatRad = (refLat * Math.PI) / 180;
  const R = 6371000;

  const toXY = (coordinate: Coordinate) => ({
    x: R * ((coordinate[0] * Math.PI) / 180) * Math.cos(refLatRad),
    y: R * ((coordinate[1] * Math.PI) / 180),
  });

  const user = toXY(userCoordinate);

  let best: ProjectionResult | null = null;

  for (let i = 0; i < trace.length - 1; i++) {
    const a = toXY(trace[i].coordinate);
    const b = toXY(trace[i + 1].coordinate);

    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;

    let t = lenSq === 0 ? 0 : ((user.x - a.x) * abx + (user.y - a.y) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = a.x + t * abx;
    const projY = a.y + t * aby;

    const dx = user.x - projX;
    const dy = user.y - projY;
    const offRouteDistance = Math.sqrt(dx * dx + dy * dy);

    const segmentLength = trace[i + 1].distanceFromStart - trace[i].distanceFromStart;
    const distanceAlongRoute = trace[i].distanceFromStart + t * segmentLength;

    if (!best || offRouteDistance < best.offRouteDistance) {
      best = { offRouteDistance, distanceAlongRoute, segmentIndex: i };
    }
  }

  return best;
}

function coordinateAtDistance(trace: TracePoint[], distance: number): Coordinate | null {
  if (!trace || trace.length === 0) return null;

  const clamped = Math.max(0, Math.min(distance, trace[trace.length - 1].distanceFromStart));

  for (let i = 0; i < trace.length - 1; i++) {
    const a = trace[i];
    const b = trace[i + 1];

    if (clamped >= a.distanceFromStart && clamped <= b.distanceFromStart) {
      const segmentLength = b.distanceFromStart - a.distanceFromStart;
      const t = segmentLength === 0 ? 0 : (clamped - a.distanceFromStart) / segmentLength;

      return [
        a.coordinate[0] + t * (b.coordinate[0] - a.coordinate[0]),
        a.coordinate[1] + t * (b.coordinate[1] - a.coordinate[1]),
      ];
    }
  }

  return trace[trace.length - 1].coordinate;
}

export {
  buildTurnByTurn,
  attachStepBoundaries,
  buildRouteTrace,
  projectOntoRoute,
  coordinateAtDistance,
  flattenRouteCoordinates,
};
export type { TurnStep, StepWithBoundary, TracePoint, ProjectionResult, Coordinate };
