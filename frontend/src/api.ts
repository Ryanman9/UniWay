import type { PoiCollection, GraphNode, GraphEdge } from "./types";

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

export function fetchPlaces(): Promise<PoiCollection> {
  return getJson<PoiCollection>("/api/places");
}

export function fetchGraph(): Promise<GraphResponse> {
  return getJson<GraphResponse>("/api/graph");
}