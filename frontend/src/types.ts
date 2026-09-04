export type PathMode = "pedestrian" | "vehicle";

export interface PoiProperties {
  id: string;
  name: string;
  type: string;
  "marker-color"?: string;
  "marker-size"?: string;
  "marker-symbol"?: string;
}

export interface PoiFeature {
  type: "Feature";
  properties: PoiProperties;
  geometry: { type: "Point"; coordinates: [number, number] };
  bbox?: [number, number, number, number];
}

export interface PoiCollection {
  type: "FeatureCollection" | "Feature";
  features: PoiFeature[];
}

export interface PathProperties {
  id: string;
  name: string;
  type: PathMode;
  "stroke-width"?: number;
}

export interface PathFeature {
  type: "Feature";
  properties: PathProperties;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  bbox?: [number, number, number, number];
}

export interface PathCollection {
  type: "FeatureCollection";
  features: PathFeature[];
}

export interface GraphNode {
  id: string;
  coordinate: [number, number];
  isPoi?: boolean;
  poiId?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: PathMode;
  distance: number;
  pathId?: string;
}

export interface ConnectResult {
  nodeId: string;
  distance: number;
}

export interface DijkstraResult {
  path: string[];
  edges: GraphEdge[];
  distance: number;
  mode: PathMode;
}

export interface RouteResult extends DijkstraResult {
  [key: string]: unknown;
}

export interface RouteTracePoint {
  coordinate: [number, number];
  cumulativeDistance: number;
  edgeIndex: number;
}

export interface NavStep {
  instruction: string;
  distance: number;
  coordinate: [number, number];
  startIndex?: number;
  endIndex?: number;
  [key: string]: unknown;
}

export interface PlaceDetails {
  placeId: string;
  description?: string;
  history?: string;
  hours?: string;
  images?: string[];
  relatedPeople?: { name: string; relation: string }[];
}

export interface Category {
  id: string;
  label: string;
  icon?: string;
}
