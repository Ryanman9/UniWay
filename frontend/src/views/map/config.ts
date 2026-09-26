export type RouteModeConfig = "vehicle" | "pedestrian";

export const ROUTE_MODE: RouteModeConfig = "vehicle";

export const ROUTE_COLORS = {
  vehicle: "#0a0d01",
  pedestrian: "#1d2704",
  marker: "#38eb4a",
};

export const ROUTE_ERASE_MIN_DELTA_METERS = 4;

export const TURN_ICONS: Record<string, string> = {
  depart: "↑",
  straight: "↑",
  slight_left: "↖",
  slight_right: "↗",
  left: "←",
  right: "→",
  u_turn: "↩",
  arrive: "●",
};

export const ARRIVAL_THRESHOLD_METERS = 15;
export const OFF_ROUTE_THRESHOLD_METERS = 30;

export const FALLBACK_SPEED_MPS: Record<string, number> = {
  vehicle: 8.3,
  pedestrian: 1.4,
};

export const OFF_ROUTE_TRIGGER_STREAK = 3;
export const REROUTE_COOLDOWN_MS = 10000;

export const SIMULATOR_SPEED_MULTIPLIER = 4;
export const SIMULATOR_TICK_MS = 300;
export const SIMULATOR_DRIFT_METERS = 45;
export const SIMULATOR_DRIFT_DURATION_MS = 6000;
