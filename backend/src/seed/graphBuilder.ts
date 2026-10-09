type Coordinate = [number, number];

export interface BuiltNode {
  nodeId: string;
  coordinate: Coordinate;
  type: "endpoint" | "intersection" | "intersection_endpoint";
  connectedPaths: string[];
}

export interface BuiltEdge {
  from: string;
  to: string;
  type: "pedestrian" | "vehicle";
  distance: number;
  pathId: string;
  coordinates: Coordinate[];
}

export function calculateDistance(a: Coordinate, b: Coordinate): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const R = 6371000;

  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function buildNodes(paths: any): BuiltNode[] {
  const coordinateMap = new Map<
    string,
    { coordinate: Coordinate; paths: Set<string>; isEndpoint: boolean }
  >();

  paths.features.forEach((feature: any) => {
    const pathId = feature.properties?.id;
    feature.geometry.coordinates.forEach((coordinate: Coordinate) => {
      const key = coordinate.join(",");
      if (!coordinateMap.has(key)) {
        coordinateMap.set(key, { coordinate, paths: new Set(), isEndpoint: false });
      }
      coordinateMap.get(key)!.paths.add(pathId);
    });
  });

  paths.features.forEach((feature: any) => {
    const coords = feature.geometry.coordinates;
    coordinateMap.get(coords[0].join(","))!.isEndpoint = true;
    coordinateMap.get(coords[coords.length - 1].join(","))!.isEndpoint = true;
  });

  const nodes: BuiltNode[] = [];

  coordinateMap.forEach((value) => {
    const isIntersection = value.paths.size > 1;
    if (!isIntersection && !value.isEndpoint) return;

    let type: BuiltNode["type"];
    if (isIntersection && value.isEndpoint) type = "intersection_endpoint";
    else if (isIntersection) type = "intersection";
    else type = "endpoint";

    nodes.push({
      nodeId: `N${nodes.length + 1}`,
      coordinate: value.coordinate,
      type,
      connectedPaths: [...value.paths],
    });
  });

  return nodes;
}

export function buildEdges(paths: any, nodes: BuiltNode[]): BuiltEdge[] {
  const edges: BuiltEdge[] = [];
  const nodeMap = new Map<string, BuiltNode>();
  nodes.forEach((node) => nodeMap.set(node.coordinate.join(","), node));

  paths.features.forEach((feature: any) => {
    const pathId = feature.properties?.id;
    const pathType = feature.properties?.type;
    const coordinates: Coordinate[] = feature.geometry.coordinates;

    let pathNodes: BuiltNode[] = [];
    coordinates.forEach((coordinate) => {
      const node = nodeMap.get(coordinate.join(","));
      if (node) pathNodes.push(node);
    });

    pathNodes = pathNodes.filter(
      (node, index) => index === 0 || node.nodeId !== pathNodes[index - 1].nodeId
    );

    for (let i = 0; i < pathNodes.length - 1; i++) {
      const fromNode = pathNodes[i];
      const toNode = pathNodes[i + 1];

      const fromIndex = coordinates.findIndex(
        (c) => c.join(",") === fromNode.coordinate.join(",")
      );
      const toIndex = coordinates.findIndex(
        (c) => c.join(",") === toNode.coordinate.join(",")
      );
      if (fromIndex === -1 || toIndex === -1) continue;

      const edgeCoordinates = coordinates.slice(fromIndex, toIndex + 1);

      let distance = 0;
      for (let j = 1; j < edgeCoordinates.length; j++) {
        distance += calculateDistance(edgeCoordinates[j - 1], edgeCoordinates[j]);
      }

      edges.push({
        from: fromNode.nodeId,
        to: toNode.nodeId,
        type: pathType,
        distance,
        pathId,
        coordinates: edgeCoordinates,
      });

      edges.push({
        from: toNode.nodeId,
        to: fromNode.nodeId,
        type: pathType,
        distance,
        pathId,
        coordinates: [...edgeCoordinates].reverse(),
      });
    }
  });

  return edges;
}