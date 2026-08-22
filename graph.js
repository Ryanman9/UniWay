function buildNodes(paths) {
  const coordinateMap = new Map();

  // --------------------------------
  // Collect every coordinate
  // --------------------------------

  paths.features.forEach((feature) => {
    const pathId = feature.properties?.id;
    const coordinates = feature.geometry.coordinates;

    coordinates.forEach((coordinate) => {
      const key = coordinate.join(",");

      if (!coordinateMap.has(key)) {
        coordinateMap.set(key, {
          coordinate: coordinate,
          paths: new Set(),
          isEndpoint: false,
        });
      }

      coordinateMap.get(key).paths.add(pathId);
    });
  });

  // --------------------------------
  // Mark path endpoints
  // --------------------------------

  paths.features.forEach((feature) => {
    const coordinates = feature.geometry.coordinates;

    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];

    coordinateMap.get(first.join(",")).isEndpoint = true;

    coordinateMap.get(last.join(",")).isEndpoint = true;
  });

  // --------------------------------
  // Create nodes
  // --------------------------------

  const nodes = [];

  coordinateMap.forEach((value) => {
    const isIntersection = value.paths.size > 1;

    if (isIntersection || value.isEndpoint) {
      let type;

      if (isIntersection && value.isEndpoint) {
        type = "intersection_endpoint";
      } else if (isIntersection) {
        type = "intersection";
      } else {
        type = "endpoint";
      }

      nodes.push({
        id: `N${nodes.length + 1}`,

        coordinate: value.coordinate,

        type: type,

        connectedPaths: [...value.paths],
      });
    }
  });

  return nodes;
}

function calculateDistance(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const R = 6371000;

  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function buildEdges(paths, nodes) {
  const edges = [];

  // Quickly find a node using its coordinate
  const nodeMap = new Map();

  nodes.forEach((node) => {
    nodeMap.set(node.coordinate.join(","), node);
  });

  paths.features.forEach((feature) => {
    const pathId = feature.properties?.id;
    const coordinates = feature.geometry.coordinates;

    let pathNodes = [];

    // --------------------------------
    // Find every node on this path
    // --------------------------------

    coordinates.forEach((coordinate) => {
      const key = coordinate.join(",");
      const node = nodeMap.get(key);

      if (node) {
        pathNodes.push(node);
      }
    });

    // Remove accidental duplicates
    pathNodes = pathNodes.filter((node, index) => {
      return index === 0 || node.id !== pathNodes[index - 1].id;
    });

    // --------------------------------
    // Create edges between consecutive nodes
    // --------------------------------

    for (let i = 0; i < pathNodes.length - 1; i++) {
      const fromNode = pathNodes[i];
      const toNode = pathNodes[i + 1];

      const fromIndex = coordinates.findIndex(
        (coordinate) => coordinate.join(",") === fromNode.coordinate.join(","),
      );

      const toIndex = coordinates.findIndex(
        (coordinate) => coordinate.join(",") === toNode.coordinate.join(","),
      );

      // Calculate distance along the actual LineString
      let distance = 0;

      for (let j = fromIndex + 1; j <= toIndex; j++) {
        distance += calculateDistance(coordinates[j - 1], coordinates[j]);
      }

      // --------------------------------
      // Add BOTH directions
      // --------------------------------

      edges.push({
        from: fromNode.id,
        to: toNode.id,
        distance: distance,
        pathId: pathId,
      });

      edges.push({
        from: toNode.id,
        to: fromNode.id,
        distance: distance,
        pathId: pathId,
      });
    }
  });

  return edges;
}

function checkGraphConnectivity(nodes, edges) {
  const adjacency = new Map();

  nodes.forEach((node) => {
    adjacency.set(node.id, []);
  });

  edges.forEach((edge) => {
    adjacency.get(edge.from).push(edge.to);
  });

  const startNode = nodes[0].id;

  const visited = new Set();
  const queue = [startNode];

  visited.add(startNode);

  while (queue.length > 0) {
    const current = queue.shift();

    const neighbours = adjacency.get(current);

    neighbours.forEach((neighbour) => {
      if (!visited.has(neighbour)) {
        visited.add(neighbour);
        queue.push(neighbour);
      }
    });
  }

  console.log("----- GRAPH CONNECTIVITY -----");

  console.log("Total nodes:", nodes.length);

  console.log("Reachable nodes:", visited.size);

  if (visited.size === nodes.length) {
    console.log("✅ Graph is fully connected");
  } else {
    console.log("❌ Graph has disconnected nodes");

    const disconnected = nodes
      .filter((node) => !visited.has(node.id))
      .map((node) => node.id);

    console.log("Disconnected:", disconnected);
  }
}

function buildPoiNodes(pois, nodes) {
  const poiNodes = [];

  pois.features.forEach((feature) => {
    const properties = feature.properties || {};

    const coordinate = feature.geometry.coordinates;

    poiNodes.push({
      id: properties.id,

      name: properties.name,

      type: "poi",

      poiType: properties.type,

      coordinate: coordinate,

      connectedPaths: [],
    });
  });

  return poiNodes;
}

function connectPoiToGraph(poiNodes, nodes) {
  const connections = [];

  poiNodes.forEach((poi) => {
    let nearestNode = null;
    let shortestDistance = Infinity;

    nodes.forEach((node) => {
      const distance = calculateDistance(poi.coordinate, node.coordinate);

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestNode = node;
      }
    });

    connections.push({
      poiId: poi.id,

      poiName: poi.name,

      nodeId: nearestNode.id,

      distance: shortestDistance,
    });
  });

  return connections;
}

function buildPoiEdges(poiConnections) {
  const edges = [];

  poiConnections.forEach((connection) => {
    edges.push({
      from: connection.poiId,
      to: connection.nodeId,
      distance: connection.distance,
      pathId: null,
    });

    edges.push({
      from: connection.nodeId,
      to: connection.poiId,
      distance: connection.distance,
      pathId: null,
    });
  });

  return edges;
}
