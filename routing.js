import { dijkstra } from "./dijkstra.js";

function findRoute(
  startPoiId,
  endPoiId,
  poiConnections,
  nodes,
  edges,
  mode = "pedestrian",
) {
  // --------------------------------
  // Find start POI connection
  // --------------------------------

  const startConnection = poiConnections.find(
    (connection) => connection.poiId === startPoiId,
  );

  // --------------------------------
  // Find destination POI connection
  // --------------------------------

  const endConnection = poiConnections.find(
    (connection) => connection.poiId === endPoiId,
  );

  if (!startConnection || !endConnection) {
    console.error("Could not find start or destination POI.");
    return null;
  }

  // --------------------------------
  // Run Dijkstra
  // --------------------------------

  const result = dijkstra(
    nodes,
    edges,
    startConnection.nodeId,
    endConnection.nodeId,
    mode,
  );

  if (!result) {
    console.error(`No ${mode} route found.`);

    return null;
  }

  // --------------------------------
  // Calculate complete distance
  // --------------------------------

  const totalDistance =
    startConnection.distance + result.distance + endConnection.distance;

  // --------------------------------
  // Return route information
  // --------------------------------

  return {
    startPoi: startPoiId,
    endPoi: endPoiId,

    startNode: startConnection.nodeId,
    endNode: endConnection.nodeId,

    mode: mode,

    path: result.path,

    graphDistance: result.distance,

    totalDistance: totalDistance,
  };
}

export { findRoute };
