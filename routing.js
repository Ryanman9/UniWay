import { dijkstra } from "./dijkstra.js";

// ============================================================
// GET VEHICLE NODES
// ============================================================

function getVehicleNodes(nodes, edges) {
  const vehicleNodeIds = new Set();

  edges.forEach((edge) => {
    if (edge.type === "vehicle") {
      vehicleNodeIds.add(edge.from);
      vehicleNodeIds.add(edge.to);
    }
  });

  return nodes.filter((node) => vehicleNodeIds.has(node.id));
}

// ============================================================
// FIND NEAREST VEHICLE NODE
// ============================================================

function findNearestVehicleNode(
  poiNodeId,
  vehicleNodes,
  nodes,
  edges,
  direction = "from-poi",
) {
  let nearestNode = null;
  let nearestRoute = null;

  for (const vehicleNode of vehicleNodes) {
    let route;

    if (direction === "from-poi") {
      // POI → Vehicle Node
      route = dijkstra(nodes, edges, poiNodeId, vehicleNode.id, "pedestrian");
    } else {
      // Vehicle Node → POI
      route = dijkstra(nodes, edges, vehicleNode.id, poiNodeId, "pedestrian");
    }

    if (!route) {
      continue;
    }

    if (!nearestRoute || route.distance < nearestRoute.distance) {
      nearestRoute = route;
      nearestNode = vehicleNode;
    }
  }

  if (!nearestNode) {
    return null;
  }

  return {
    node: nearestNode,
    route: nearestRoute,
  };
}

// ============================================================
// FIND VEHICLE ROUTE
// ============================================================

function findVehicleRoute(
  startPoiId,
  endPoiId,
  startConnection,
  endConnection,
  nodes,
  edges,
) {
  const vehicleNodes = getVehicleNodes(nodes, edges);

  if (vehicleNodes.length === 0) {
    console.error("No vehicle nodes found.");
    return null;
  }

  // ==========================================================
  // START
  // ==========================================================

  const startAccess = findNearestVehicleNode(
    startConnection.nodeId,
    vehicleNodes,
    nodes,
    edges,
    "from-poi",
  );

  if (!startAccess) {
    console.error("Could not reach a vehicle-accessible road from start POI.");

    return null;
  }

  // ==========================================================
  // DESTINATION
  // ==========================================================

  const endAccess = findNearestVehicleNode(
    endConnection.nodeId,
    vehicleNodes,
    nodes,
    edges,
    "to-poi",
  );

  if (!endAccess) {
    console.error(
      "Could not reach destination from a vehicle-accessible road.",
    );

    return null;
  }

  // ==========================================================
  // VEHICLE ROUTE
  // ==========================================================

  const vehicleRoute = dijkstra(
    nodes,
    edges,
    startAccess.node.id,
    endAccess.node.id,
    "vehicle",
  );

  if (!vehicleRoute) {
    console.error("No vehicle route between accessible vehicle nodes.");

    return null;
  }

  // ==========================================================
  // TOTAL DISTANCE
  // ==========================================================

  const totalDistance =
    startConnection.distance +
    startAccess.route.distance +
    vehicleRoute.distance +
    endAccess.route.distance +
    endConnection.distance;

  // ==========================================================
  // RESULT
  // ==========================================================

  return {
    startPoi: startPoiId,
    endPoi: endPoiId,

    startNode: startConnection.nodeId,
    endNode: endConnection.nodeId,

    startVehicleNode: startAccess.node.id,
    endVehicleNode: endAccess.node.id,

    mode: "vehicle",

    totalDistance,

    graphDistance:
      startAccess.route.distance +
      vehicleRoute.distance +
      endAccess.route.distance,

    segments: [
      {
        mode: "pedestrian",
        reason: "access",
        path: startAccess.route.path,
        edges: startAccess.route.edges,
        distance: startAccess.route.distance,
      },

      {
        mode: "vehicle",
        reason: "vehicle_route",
        path: vehicleRoute.path,
        edges: vehicleRoute.edges,
        distance: vehicleRoute.distance,
      },

      {
        mode: "pedestrian",
        reason: "destination_access",
        path: endAccess.route.path,
        edges: endAccess.route.edges,
        distance: endAccess.route.distance,
      },
    ],

    path: [
      ...startAccess.route.path,
      ...vehicleRoute.path.slice(1),
      ...endAccess.route.path.slice(1),
    ],
  };
}

// ============================================================
// MAIN ROUTER
// ============================================================

function findRoute(
  startPoiId,
  endPoiId,
  poiConnections,
  nodes,
  edges,
  mode = "pedestrian",
) {
  const startConnection = poiConnections.find(
    (connection) => connection.poiId === startPoiId,
  );

  const endConnection = poiConnections.find(
    (connection) => connection.poiId === endPoiId,
  );

  if (!startConnection || !endConnection) {
    console.error("Could not find start or destination POI.");

    return null;
  }

  // ==========================================================
  // PEDESTRIAN
  // ==========================================================

  if (mode === "pedestrian") {
    const result = dijkstra(
      nodes,
      edges,
      startConnection.nodeId,
      endConnection.nodeId,
      "pedestrian",
    );

    if (!result) {
      console.error("No pedestrian route found.");
      return null;
    }

    return {
      startPoi: startPoiId,
      endPoi: endPoiId,

      startNode: startConnection.nodeId,
      endNode: endConnection.nodeId,

      mode: "pedestrian",

      path: result.path,

      graphDistance: result.distance,

      totalDistance:
        startConnection.distance + result.distance + endConnection.distance,

      segments: [
        {
          mode: "pedestrian",
          reason: "walking",
          path: result.path,
          edges: result.edges,
          distance: result.distance,
        },
      ],
    };
  }

  // ==========================================================
  // VEHICLE
  // ==========================================================

  if (mode === "vehicle") {
    return findVehicleRoute(
      startPoiId,
      endPoiId,
      startConnection,
      endConnection,
      nodes,
      edges,
    );
  }

  console.error("Unknown routing mode:", mode);

  return null;
}

export { findRoute };
