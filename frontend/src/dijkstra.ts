import type { GraphNode, GraphEdge, DijkstraResult, PathMode } from "./types";

function dijkstra(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startId: string,
  endId: string,
  mode: PathMode = "pedestrian"
): DijkstraResult | null {
  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const previousEdge: Record<string, GraphEdge | null> = {};
  const unvisited = new Set<string>();

  nodes.forEach((node) => {
    distances[node.id] = Infinity;
    previous[node.id] = null;
    previousEdge[node.id] = null;
    unvisited.add(node.id);
  });

  distances[startId] = 0;

  while (unvisited.size > 0) {
    let current: string | null = null;
    let smallestDistance = Infinity;

    for (const nodeId of unvisited) {
      if (distances[nodeId] < smallestDistance) {
        smallestDistance = distances[nodeId];
        current = nodeId;
      }
    }

    if (current === null) {
      break;
    }

    if (current === endId) {
      break;
    }

    unvisited.delete(current);

    const currentEdges = edges.filter((edge) => {
      if (edge.from !== current) {
        return false;
      }

      if (mode === "pedestrian") {
        return edge.type === "pedestrian" || edge.type === "vehicle";
      }

      if (mode === "vehicle") {
        return edge.type === "vehicle";
      }

      return false;
    });

    for (const edge of currentEdges) {
      if (!unvisited.has(edge.to)) {
        continue;
      }

      const newDistance = distances[current] + edge.distance;

      if (newDistance < distances[edge.to]) {
        distances[edge.to] = newDistance;
        previous[edge.to] = current;

        previousEdge[edge.to] = edge;
      }
    }
  }

  if (distances[endId] === Infinity) {
    return null;
  }

  const path: string[] = [];
  const routeEdges: GraphEdge[] = [];

  let current: string | null = endId;

  while (current !== null) {
    path.unshift(current);

    const edge = previousEdge[current];
    if (edge) {
      routeEdges.unshift(edge);
    }

    current = previous[current];
  }

  return {
    path,
    edges: routeEdges,
    distance: distances[endId],
    mode,
  };
}

export { dijkstra };
