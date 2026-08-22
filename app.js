import {
  buildNodes,
  buildEdges,
  checkGraphConnectivity,
  buildPoiNodes,
  connectPoiToGraph,
} from "./graph.js";

import { findRoute } from "./routing.js";

const map = L.map("map").setView([27.916, 78.074], 17);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// ============================================================
// DRAW ROUTE
// ============================================================

function drawRoute(route, nodes, pois, startPoiId, endPoiId) {
  if (!route) {
    console.error("No route to draw.");
    return;
  }

  // ----------------------------------------------------------
  // 1. Convert graph node IDs → Leaflet coordinates
  // ----------------------------------------------------------

  const routeCoordinates = route.path
    .map((nodeId) => {
      const node = nodes.find((node) => node.id === nodeId);

      if (!node) {
        console.error("Node not found:", nodeId);
        return null;
      }

      // GeoJSON: [longitude, latitude]
      // Leaflet: [latitude, longitude]

      return [node.coordinate[1], node.coordinate[0]];
    })
    .filter(Boolean);

  console.log("ROUTE COORDINATES:", routeCoordinates);

  // ----------------------------------------------------------
  // 2. Draw route
  // ----------------------------------------------------------

  L.polyline(routeCoordinates, {
    color: "red",
    weight: 7,
    opacity: 0.9,
  }).addTo(map);

  // ----------------------------------------------------------
  // 3. Find actual POIs
  // ----------------------------------------------------------

  const startPoi = pois.features.find(
    (feature) => feature.properties.id === startPoiId,
  );

  const endPoi = pois.features.find(
    (feature) => feature.properties.id === endPoiId,
  );

  if (!startPoi || !endPoi) {
    console.error("Could not find start or destination POI.");
    return;
  }

  // ----------------------------------------------------------
  // 4. Start marker
  // ----------------------------------------------------------

  L.marker([startPoi.geometry.coordinates[1], startPoi.geometry.coordinates[0]])
    .addTo(map)
    .bindPopup(`<strong>Start:</strong> ${startPoi.properties.name}`);

  // ----------------------------------------------------------
  // 5. Destination marker
  // ----------------------------------------------------------

  L.marker([endPoi.geometry.coordinates[1], endPoi.geometry.coordinates[0]])
    .addTo(map)
    .bindPopup(`<strong>Destination:</strong> ${endPoi.properties.name}`);

  // ----------------------------------------------------------
  // 6. Display distance
  // ----------------------------------------------------------

  console.log(`ROUTE: ${startPoi.properties.name} → ${endPoi.properties.name}`);

  console.log(`Graph distance: ${route.graphDistance.toFixed(2)}m`);

  console.log(`Total distance: ${route.totalDistance.toFixed(2)}m`);
}

// ============================================================
// LOAD DATA
// ============================================================

Promise.all([
  fetch("./data/paths.json").then((response) => response.json()),
  fetch("./data/pois.json").then((response) => response.json()),
])

  .then(([paths, pois]) => {
    // ========================================================
    // DISPLAY PATHS
    // ========================================================

    L.geoJSON(paths, {
      style: function (feature) {
        const type = feature.properties?.type;

        return {
          color: type === "vehicle" ? "blue" : "green",
          weight: type === "vehicle" ? 5 : 3,
        };
      },
    }).addTo(map);

    // ========================================================
    // DISPLAY POIs
    // ========================================================

    L.geoJSON(pois, {
      pointToLayer: function (feature, latlng) {
        return L.marker(latlng);
      },

      onEachFeature: function (feature, layer) {
        const p = feature.properties || {};

        layer.bindPopup(`
          <strong>${p.name || "Unnamed"}</strong><br>
          ID: ${p.id || "N/A"}<br>
          Type: ${p.type || "N/A"}
        `);
      },
    }).addTo(map);

    // ========================================================
    // BUILD GRAPH
    // ========================================================

    const nodes = buildNodes(paths);

    const edges = buildEdges(paths, nodes);

    console.log("EDGES WITH TYPES");

    edges.forEach((edge) => {
      console.log(
        `${edge.from} → ${edge.to} | ` +
          `${edge.distance.toFixed(2)}m | ` +
          `${edge.pathId} | ` +
          `${edge.type}`,
      );
    });

    // ========================================================
    // CHECK GRAPH
    // ========================================================

    checkGraphConnectivity(nodes, edges);

    // ========================================================
    // BUILD POI NODES
    // ========================================================

    const poiNodes = buildPoiNodes(pois, nodes);

    console.log("POI NODES");
    console.log(poiNodes);

    // ========================================================
    // CONNECT POIs TO GRAPH
    // ========================================================

    const poiConnections = connectPoiToGraph(poiNodes, nodes);

    console.log("POI CONNECTIONS");

    poiConnections.forEach((connection) => {
      console.log(
        `${connection.poiName} (${connection.poiId}) → ` +
          `${connection.nodeId} | ` +
          `${connection.distance.toFixed(2)}m`,
      );
    });

    // ========================================================
    // TEST ROUTING
    // ========================================================

    const startPoi = "B008"; // ZHCET
    const endPoi = "B003"; // Biochemical Dept

    const mode = "pedestrian";

    const route = findRoute(
      startPoi,
      endPoi,
      poiConnections,
      nodes,
      edges,
      mode,
    );

    console.log("ROUTE RESULT");
    console.log(route);

    // ========================================================
    // DRAW ROUTE
    // ========================================================

    if (route) {
      drawRoute(route, nodes, pois, startPoi, endPoi);
    }

    // ========================================================
    // DEBUG GRAPH NODES
    // ========================================================

    console.log("GRAPH NODES");

    nodes.forEach((node) => {
      console.log(
        `${node.id} | ` +
          `${node.type} | ` +
          `${node.coordinate.join(", ")} | ` +
          `Paths: ${node.connectedPaths.join(", ")}`,
      );
    });

    // ========================================================
    // DEBUG GRAPH EDGES
    // ========================================================

    console.log("GRAPH EDGES");

    edges.forEach((edge) => {
      console.log(
        `${edge.from} → ${edge.to} | ` +
          `${edge.distance.toFixed(2)}m | ` +
          `${edge.pathId}`,
      );
    });

    console.log("Total edges:", edges.length);
  })

  .catch((error) => {
    console.error("ERROR:", error);
  });
