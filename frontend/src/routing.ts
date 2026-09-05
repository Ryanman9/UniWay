import { dijkstra } from "./dijkstra";
import type { GraphNode, GraphEdge, PathMode } from "./types";

interface PoiConnection {
  poiId: string;
  poiName: string;
  nodeId: string;
  distance: number;
}

interface RouteSegment {
  mode: PathMode;
  reason: string;
  path: string[];
  edges: GraphEdge[];
  distance: number;
}

export interface RouteResult {
  startPoi: string;
  endPoi: string;
  startNode: string;
  endNode: string;
  startVehicleNode?: string;
  endVehicleNode?: string;
  mode: PathMode;
  path: string[];
  graphDistance: number;
  totalDistance: number;
  segments: RouteSegment[];
}

function getVehicleNodes(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const vehicleNodeIds = new Set<string>();

  edges.forEach((edge) => {
    if (edge.type === "vehicle") {
      vehicleNodeIds.add(edge.from);
      vehicleNodeIds.add(edge.to);
    }
  });

  return nodes.filter((node) => vehicleNodeIds.has(node.id));
}

function findNearestVehicleNode(
  poiNodeId: string,
  vehicleNodes: GraphNode[],
  nodes: GraphNode[],
  edges: GraphEdge[]
): { node: GraphNode; route: NonNullable<ReturnType<typeof dijkstra>> } | null {
  let nearestNode: GraphNode | null = null;
  let nearestRoute: NonNullable<ReturnType<typeof dijkstra>> | null = null;

  for (const vehicleNode of vehicleNodes) {
    const route = dijkstra(nodes, edges, poiNodeId, vehicleNode.id, "pedestrian");

    if (!route) {
      continue;
    }

    if (!nearestRoute || route.distance < nearestRoute.distance) {
      nearestRoute = route;
      nearestNode = vehicleNode;
    }
  }

  if (!nearestNode || !nearestRoute) {
    return null;
  }

  return {
    node: nearestNode,
    route: nearestRoute,
  };
}

function findVehicleRoute(
  startPoiId: string,
  endPoiId: string,
  startConnection: PoiConnection,
  endConnection: PoiConnection,
  nodes: GraphNode[],
  edges: GraphEdge[]
): RouteResult | null {
  const vehicleNodes = getVehicleNodes(nodes, edges);

  if (vehicleNodes.length === 0) {
    console.error("No vehicle nodes found.");
    return null;
  }

  const startAccess = findNearestVehicleNode(
    startConnection.nodeId,
    vehicleNodes,
    nodes,
    edges
  );

  if (!startAccess) {
    console.error("Could not reach a vehicle-accessible road from start POI.");
    return null;
  }

  const endAccess = findNearestVehicleNode(
    endConnection.nodeId,
    vehicleNodes,
    nodes,
    edges
  );

  if (!endAccess) {
    console.error("Could not reach destination from a vehicle-accessible road.");
    return null;
  }

  const vehicleRoute = dijkstra(
    nodes,
    edges,
    startAccess.node.id,
    endAccess.node.id,
    "vehicle"
  );

  if (!vehicleRoute) {
    console.error("No vehicle route between accessible vehicle nodes.");
    return null;
  }

  const totalDistance =
    startConnection.distance +
    startAccess.route.distance +
    vehicleRoute.distance +
    endAccess.route.distance +
    endConnection.distance;

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

function findRoute(
  startPoiId: string,
  endPoiId: string,
  poiConnections: PoiConnection[],
  nodes: GraphNode[],
  edges: GraphEdge[],
  mode: PathMode = "pedestrian"
): RouteResult | null {
  const startConnection = poiConnections.find(
    (connection) => connection.poiId === startPoiId
  );

  const endConnection = poiConnections.find(
    (connection) => connection.poiId === endPoiId
  );

  if (!startConnection || !endConnection) {
    console.error("Could not find start or destination POI.");
    return null;
  }

  if (mode === "pedestrian") {
    const result = dijkstra(
      nodes,
      edges,
      startConnection.nodeId,
      endConnection.nodeId,
      "pedestrian"
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

  if (mode === "vehicle") {
    return findVehicleRoute(
      startPoiId,
      endPoiId,
      startConnection,
      endConnection,
      nodes,
      edges
    );
  }

  console.error("Unknown routing mode:", mode);
  return null;
}

export { findRoute };
