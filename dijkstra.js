function dijkstra(nodes, edges, startId, endId, mode = "pedestrian") {
  const distances = {};
  const previous = {};
  const previousEdge = {};
  const unvisited = new Set();

  // ============================================================
  // INITIALIZE
  // ============================================================

  nodes.forEach((node) => {
    distances[node.id] = Infinity;
    previous[node.id] = null;
    previousEdge[node.id] = null;
    unvisited.add(node.id);
  });

  distances[startId] = 0;

  // ============================================================
  // DIJKSTRA
  // ============================================================

  while (unvisited.size > 0) {
    let current = null;
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

    // ==========================================================
    // ALLOWED EDGES
    // ==========================================================

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

    // ==========================================================
    // RELAX EDGES
    // ==========================================================

    for (const edge of currentEdges) {
      if (!unvisited.has(edge.to)) {
        continue;
      }

      const newDistance = distances[current] + edge.distance;

      if (newDistance < distances[edge.to]) {
        distances[edge.to] = newDistance;
        previous[edge.to] = current;

        // IMPORTANT
        previousEdge[edge.to] = edge;
      }
    }
  }

  // ============================================================
  // NO ROUTE
  // ============================================================

  if (distances[endId] === Infinity) {
    return null;
  }

  // ============================================================
  // RECONSTRUCT
  // ============================================================

  const path = [];
  const routeEdges = [];

  let current = endId;

  while (current !== null) {
    path.unshift(current);

    if (previousEdge[current]) {
      routeEdges.unshift(previousEdge[current]);
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
