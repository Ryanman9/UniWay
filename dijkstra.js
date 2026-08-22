function dijkstra(nodes, edges, startId, endId) {
  const distances = {};
  const previous = {};
  const unvisited = new Set();

  nodes.forEach((node) => {
    distances[node.id] = Infinity;
    previous[node.id] = null;
    unvisited.add(node.id);
  });

  distances[startId] = 0;

  while (unvisited.size > 0) {
    let current = null;
    let smallestDistance = Infinity;

    for (const nodeId of unvisited) {
      if (distances[nodeId] < smallestDistance) {
        smallestDistance = distances[nodeId];
        current = nodeId;
      }
    }

    if (current === null) break;

    if (current === endId) break;

    unvisited.delete(current);

    const currentEdges = edges.filter((edge) => edge.from === current);

    for (const edge of currentEdges) {
      if (!unvisited.has(edge.to)) continue;

      const newDistance = distances[current] + edge.distance;

      if (newDistance < distances[edge.to]) {
        distances[edge.to] = newDistance;
        previous[edge.to] = current;
      }
    }
  }

  if (distances[endId] === Infinity) {
    return null;
  }

  const route = [];
  let current = endId;

  while (current !== null) {
    route.unshift(current);
    current = previous[current];
  }

  return {
    path: route,
    distance: distances[endId],
  };
}
