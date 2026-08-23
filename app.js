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

function findPoiByName(pois, searchText) {
  const query = searchText.trim().toLowerCase();

  return pois.features.find((feature) => {
    const name = feature.properties?.name?.toLowerCase();

    return name === query;
  });
}

// ============================================================
// DRAW ROUTE
// ============================================================

function drawRoute(route, nodes, paths, pois, startPoiId, endPoiId) {
  if (!route) {
    console.error("No route to draw.");
    return;
  }

  // ==========================================================
  // DRAW SELECTED ROUTE
  // ==========================================================

  route.segments.forEach((segment) => {
    if (!segment.edges || segment.edges.length === 0) {
      return;
    }

    segment.edges.forEach((edge) => {
      if (!edge.coordinates || edge.coordinates.length < 2) {
        console.error("Edge has no geometry:", edge.from, edge.to);

        return;
      }

      // GeoJSON [longitude, latitude]
      // Leaflet [latitude, longitude]

      const coordinates = edge.coordinates.map(([longitude, latitude]) => [
        latitude,
        longitude,
      ]);

      const isVehicle = segment.mode === "vehicle";

      L.polyline(coordinates, {
        color: isVehicle ? "red" : "yellow",

        weight: 6,

        opacity: 0.95,

        dashArray: isVehicle ? null : "8, 8",
      }).addTo(map);
    });
  });

  // ==========================================================
  // FIND POIs
  // ==========================================================

  const startPoi = pois.features.find(
    (feature) => feature.properties.id === startPoiId,
  );

  const endPoi = pois.features.find(
    (feature) => feature.properties.id === endPoiId,
  );

  if (!startPoi || !endPoi) {
    console.error("Could not find POIs.");
    return;
  }

  // ==========================================================
  // START MARKER
  // ==========================================================

  L.marker([startPoi.geometry.coordinates[1], startPoi.geometry.coordinates[0]])
    .addTo(map)
    .bindPopup(`<strong>Start:</strong> ${startPoi.properties.name}`);

  // ==========================================================
  // DESTINATION MARKER
  // ==========================================================

  L.marker([endPoi.geometry.coordinates[1], endPoi.geometry.coordinates[0]])
    .addTo(map)
    .bindPopup(`<strong>Destination:</strong> ${endPoi.properties.name}`);

  // ==========================================================
  // ROUTE INFORMATION
  // ==========================================================

  console.log(`ROUTE: ${startPoi.properties.name} → ${endPoi.properties.name}`);

  console.log(`Start vehicle node: ${route.startVehicleNode}`);

  console.log(`End vehicle node: ${route.endVehicleNode}`);

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

    console.log("========== EDGE GEOMETRY ==========");

    edges.forEach((edge) => {
      console.log(
        `${edge.from} → ${edge.to} | ` +
          `${edge.pathId} | ` +
          `${edge.type} | ` +
          `${edge.distance.toFixed(2)}m | ` +
          `${edge.coordinates.length} coordinates`,
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

    const startPoiName = "Commerce Dept";
    const endPoiName = "Physics Dept";

    const mode = "vehicle";

    const startPoi = findPoiByName(pois, startPoiName);
    const endPoi = findPoiByName(pois, endPoiName);

    if (!startPoi || !endPoi) {
      console.error("Could not find start or destination.");
      return;
    }

    const startPoiId = startPoi.properties.id;
    const endPoiId = endPoi.properties.id;

    const route = findRoute(
      startPoiId,
      endPoiId,
      poiConnections,
      nodes,
      edges,
      mode,
    );

    console.log("ROUTE RESULT");
    console.log(route);

    if (route) {
      console.log("========== ROUTE SEGMENTS ==========");

      route.segments.forEach((segment, index) => {
        console.log(`SEGMENT ${index + 1}`);
        console.log("MODE:", segment.mode);
        console.log("PATH:", segment.path);
      });
    }

    // ========================================================
    // DRAW ROUTE
    // ========================================================

    if (route) {
      drawRoute(route, nodes, paths, pois, startPoiId, endPoiId);
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
