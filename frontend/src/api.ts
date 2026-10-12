import type {
  PoiCollection,
  GraphNode,
  GraphEdge,
  Category,
  PlaceResponse,
} from "./types";

const API_BASE_URL: string =
  typeof __API_BASE_URL__ !== "undefined" ? __API_BASE_URL__ : "http://localhost:4000";

const REQUEST_TIMEOUT_MS = 8000;

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

async function getJson<T>(path: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`GET ${path} failed with HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface PlacesQuery {
  type?: string;
  q?: string;
}

export function fetchPlaces(query: PlacesQuery = {}): Promise<PoiCollection> {
  const params = new URLSearchParams();
  if (query.type) params.set("type", query.type);
  if (query.q) params.set("q", query.q);

  const qs = params.toString();
  return getJson<PoiCollection>(`/api/places${qs ? `?${qs}` : ""}`);
}

export function fetchCategories(): Promise<Category[]> {
  return getJson<Category[]>("/api/categories");
}

export function fetchPlace(placeId: string): Promise<PlaceResponse> {
  return getJson<PlaceResponse>(`/api/places/${encodeURIComponent(placeId)}`);
}

export function fetchGraph(): Promise<GraphResponse> {
  return getJson<GraphResponse>("/api/graph");
}