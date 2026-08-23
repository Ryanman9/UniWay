function dijkstra(nodes, edges, startId, endId, mode = "pedestrian") {
  const distances = {};
  const previous = {};
  const unvisited = new Set();

  // --------------------------------
  // INITIALIZE
  // --------------------------------

  nodes.forEach((node) => {
    distances[node.id] = Infinity;
    previous[node.id] = null;
    unvisited.add(node.id);
  });

  distances[startId] = 0;

  // --------------------------------
  // DIJKSTRA
  // --------------------------------

  while (unvisited.size > 0) {
    let current = null;
    let smallestDistance = Infinity;

    // Find unvisited node with smallest distance
    for (const nodeId of unvisited) {
      if (distances[nodeId] < smallestDistance) {
        smallestDistance = distances[nodeId];
        current = nodeId;
      }
    }

    // No reachable node remaining
    if (current === null) {
      break;
    }

    // Destination reached
    if (current === endId) {
      break;
    }

    unvisited.delete(current);

    // --------------------------------
    // GET ALLOWED EDGES
    // --------------------------------

    const currentEdges = edges.filter((edge) => {
      if (edge.from !== current) {
        return false;
      }

      // Pedestrians can use both types
      if (mode === "pedestrian") {
        return edge.type === "pedestrian" || edge.type === "vehicle";
      }

      if (mode === "vehicle") {
        return edge.type === "vehicle";
      }

      return false;
    });

    // --------------------------------
    // RELAX EDGES
    // --------------------------------

    for (const edge of currentEdges) {
      if (!unvisited.has(edge.to)) {
        continue;
      }

      const newDistance = distances[current] + edge.distance;

      if (newDistance < distances[edge.to]) {
        distances[edge.to] = newDistance;
        previous[edge.to] = current;
      }
    }
  }

  // --------------------------------
  // NO ROUTE
  // --------------------------------

  if (distances[endId] === Infinity) {
    return null;
  }

  // --------------------------------
  // RECONSTRUCT ROUTE
  // --------------------------------

  const route = [];

  let current = endId;

  while (current !== null) {
    route.unshift(current);
    current = previous[current];
  }

  return {
    path: route,
    distance: distances[endId],
    mode: mode,
  };
}

export { dijkstra };
