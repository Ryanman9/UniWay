import type {
  PathCollection,
  PoiCollection,
  GraphNode,
  GraphEdge,
  ConnectResult,
} from "./types";

interface CoordinateEntry {
  coordinate: [number, number];
  paths: Set<string>;
  isEndpoint: boolean;
}

function buildNodes(paths: PathCollection): GraphNode[] {
  const coordinateMap = new Map<string, CoordinateEntry>();

  paths.features.forEach((feature) => {
    const pathId = feature.properties?.id;
    const coordinates = feature.geometry.coordinates;

    coordinates.forEach((coordinate) => {
      const key = coordinate.join(",");

      if (!coordinateMap.has(key)) {
        coordinateMap.set(key, {
          coordinate,
          paths: new Set(),
          isEndpoint: false,
        });
      }

      coordinateMap.get(key)!.paths.add(pathId);
    });
  });

  paths.features.forEach((feature) => {
    const coordinates = feature.geometry.coordinates;

    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];

    coordinateMap.get(first.join(","))!.isEndpoint = true;
    coordinateMap.get(last.join(","))!.isEndpoint = true;
  });

  const nodes: (GraphNode & { type: string; connectedPaths: string[] })[] = [];

  coordinateMap.forEach((value) => {
    const isIntersection = value.paths.size > 1;

    if (isIntersection || value.isEndpoint) {
      let type: string;

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
        type,
        connectedPaths: [...value.paths],
      });
    }
  });

  return nodes;
}

function calculateDistance(
  coord1: [number, number],
  coord2: [number, number]
): number {
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

function buildEdges(
  paths: PathCollection,
  nodes: GraphNode[]
): (GraphEdge & { coordinates: [number, number][] })[] {
  const edges: (GraphEdge & { coordinates: [number, number][] })[] = [];

  const nodeMap = new Map<string, GraphNode>();

  nodes.forEach((node) => {
    nodeMap.set(node.coordinate.join(","), node);
  });

  paths.features.forEach((feature) => {
    const pathId = feature.properties?.id;
    const pathType = feature.properties?.type;
    const coordinates = feature.geometry.coordinates;

    let pathNodes: GraphNode[] = [];

    coordinates.forEach((coordinate) => {
      const key = coordinate.join(",");
      const node = nodeMap.get(key);

      if (node) {
        pathNodes.push(node);
      }
    });

    pathNodes = pathNodes.filter((node, index) => {
      return index === 0 || node.id !== pathNodes[index - 1].id;
    });

    for (let i = 0; i < pathNodes.length - 1; i++) {
      const fromNode = pathNodes[i];
      const toNode = pathNodes[i + 1];

      const fromIndex = coordinates.findIndex(
        (coordinate) => coordinate.join(",") === fromNode.coordinate.join(",")
      );

      const toIndex = coordinates.findIndex(
        (coordinate) => coordinate.join(",") === toNode.coordinate.join(",")
      );

      if (fromIndex === -1 || toIndex === -1) {
        continue;
      }

      const edgeCoordinates = coordinates.slice(fromIndex, toIndex + 1) as [
        number,
        number
      ][];

      let distance = 0;

      for (let j = 1; j < edgeCoordinates.length; j++) {
        distance += calculateDistance(
          edgeCoordinates[j - 1],
          edgeCoordinates[j]
        );
      }

      edges.push({
        from: fromNode.id,
        to: toNode.id,
        distance,
        pathId,
        type: pathType,
        coordinates: edgeCoordinates,
      });

      edges.push({
        from: toNode.id,
        to: fromNode.id,
        distance,
        pathId,
        type: pathType,
        coordinates: [...edgeCoordinates].reverse() as [number, number][],
      });
    }
  });

  return edges;
}

function checkGraphConnectivity(nodes: GraphNode[], edges: GraphEdge[]): void {
  const adjacency = new Map<string, string[]>();

  nodes.forEach((node) => {
    adjacency.set(node.id, []);
  });

  edges.forEach((edge) => {
    adjacency.get(edge.from)?.push(edge.to);
  });

  const startNode = nodes[0].id;

  const visited = new Set<string>();
  const queue: string[] = [startNode];

  visited.add(startNode);

  while (queue.length > 0) {
    const current = queue.shift()!;

    const neighbours = adjacency.get(current) ?? [];

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

interface PoiNode extends GraphNode {
  name: string;
  type: string;
  poiType: string;
  connectedPaths: string[];
}

function buildPoiNodes(pois: PoiCollection, nodes: GraphNode[]): PoiNode[] {
  const poiNodes: PoiNode[] = [];

  pois.features.forEach((feature) => {
    const properties = feature.properties || ({} as PoiCollection["features"][number]["properties"]);
    const coordinate = feature.geometry.coordinates;

    poiNodes.push({
      id: properties.id,
      name: properties.name,
      type: "poi",
      poiType: properties.type,
      coordinate,
      connectedPaths: [],
    });
  });

  return poiNodes;
}

interface PoiConnection {
  poiId: string;
  poiName: string;
  nodeId: string;
  distance: number;
}

function connectPoiToGraph(
  poiNodes: (GraphNode & { name: string })[],
  nodes: GraphNode[]
): PoiConnection[] {
  const connections: PoiConnection[] = [];

  poiNodes.forEach((poi) => {
    let nearestNode: GraphNode | null = null;
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
      nodeId: nearestNode!.id,
      distance: shortestDistance,
    });
  });

  return connections;
}

function buildPoiEdges(poiConnections: PoiConnection[]): GraphEdge[] {
  const edges: GraphEdge[] = [];

  poiConnections.forEach((connection) => {
    edges.push({
      from: connection.poiId,
      to: connection.nodeId,
      distance: connection.distance,
      pathId: undefined,
      type: "pedestrian",
    });

    edges.push({
      from: connection.nodeId,
      to: connection.poiId,
      distance: connection.distance,
      pathId: undefined,
      type: "pedestrian",
    });
  });

  return edges;
}

function connectCoordinateToGraph(
  coordinate: [number, number],
  nodes: GraphNode[]
): ConnectResult | null {
  let nearestNode: GraphNode | null = null;
  let shortestDistance = Infinity;

  nodes.forEach((node) => {
    const distance = calculateDistance(coordinate, node.coordinate);

    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestNode = node;
    }
  });

  if (!nearestNode) {
    return null;
  }

  return {
    nodeId: (nearestNode as GraphNode).id,
    distance: shortestDistance,
  };
}

export {
  buildNodes,
  buildEdges,
  checkGraphConnectivity,
  buildPoiNodes,
  connectPoiToGraph,
  buildPoiEdges,
  connectCoordinateToGraph,
  calculateDistance,
};
