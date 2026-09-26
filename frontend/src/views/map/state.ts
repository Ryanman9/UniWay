export const state = {

  map: null as any,
  Geolocation: null as any,
  KeepAwake: null as any,
  firstSymbolLayerId: undefined as string | null | undefined,

  lastRouteErasedAtDistance: null as number | null,
  startMarker: null as any,
  destinationMarker: null as any,

  gpsPuckMarker: null as any,
  gpsWatchId: null as any,

  poisData: null as any,
  selectedStart: null as any,
  selectedEnd: null as any,
  activeField: null as "start" | "end" | null,

  graphNodes: null as any,
  graphEdges: null as any,
  graphPoiConnections: null as any,

  stepListItems: [] as HTMLLIElement[],

  activeRoute: null as any,
  activeSteps: null as any,
  routeTrace: null as any,
  hasArrived: false,

  offRouteStreak: 0,
  lastRerouteAt: 0,
  isRerouting: false,

  simulatorIntervalId: null as any,
  simulatedDistance: 0,
  simulatorDriftUntil: 0,
  lastCleanSimCoordinate: null as [number, number] | null,
};
