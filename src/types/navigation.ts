export type Coordinate = [number, number];
export type TravelMode = 'pedestrian' | 'vehicle';
export interface GeoFeature { type: 'Feature'; properties: Record<string, string>; geometry: {type: 'Point' | 'LineString'; coordinates: Coordinate | Coordinate[]}; }
export interface FeatureCollection {type: 'FeatureCollection'; features: GeoFeature[];}
export interface Node {id: string; coordinate: Coordinate;}
export interface Edge {from: string; to: string; distance: number; pathId: string; type: TravelMode; coordinates: Coordinate[];}
export interface PoiConnection {poiId: string; poiName: string; nodeId: string; distance: number;}
export interface RouteSegment {mode: TravelMode; reason: string; edges: Edge[]; distance: number;}
export interface Route {startPoi: string; endPoi: string; mode: TravelMode; totalDistance: number; segments: RouteSegment[];}
