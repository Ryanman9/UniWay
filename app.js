const map = L.map("map").setView([27.916, 78.074], 17);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// --------------------
// DRAW ROUTE
// --------------------

function drawRoute(route, nodes) {
  if (!route || route.length === 0) {
    console.error("No route to draw.");
    return;
  }

  const coordinates = route
    .map((nodeId) => {
      const node = nodes.find((node) => node.id === nodeId);

      if (!node) {
        console.error("Node not found:", nodeId);
        return null;
      }

      // Graph: [longitude, latitude]
      // Leaflet: [latitude, longitude]
      return [node.coordinate[1], node.coordinate[0]];
    })
    .filter(Boolean);

  console.log("ROUTE COORDINATES:", coordinates);

  L.polyline(coordinates, {
    color: "red",
    weight: 7,
    opacity: 0.9,
  }).addTo(map);
}

// --------------------
// LOAD DATA
// --------------------

Promise.all([
  fetch("./data/paths.json").then((response) => response.json()),
  fetch("./data/pois.json").then((response) => response.json()),
])
  .then(([paths, pois]) => {
    // --------------------
    // DISPLAY PATHS
    // --------------------

    L.geoJSON(paths, {
      style: {
        color: "blue",
        weight: 4,
      },
    }).addTo(map);

    // --------------------
    // DISPLAY POIs
    // --------------------

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

    // --------------------
    // BUILD GRAPH
    // --------------------

    const nodes = buildNodes(paths);

    const edges = buildEdges(paths, nodes);

    // --------------------
    // CHECK CONNECTIVITY
    // --------------------

    checkGraphConnectivity(nodes, edges);

    // --------------------
    // BUILD POI NODES
    // --------------------

    const poiNodes = buildPoiNodes(pois, nodes);

    console.log("POI NODES");
    console.log(poiNodes);

    // --------------------
    // CONNECT POIs TO GRAPH
    // --------------------

    const poiConnections = connectPoiToGraph(poiNodes, nodes);

    console.log("POI CONNECTIONS");

    poiConnections.forEach((connection) => {
      console.log(
        `${connection.poiName} (${connection.poiId}) → ` +
          `${connection.nodeId} | ` +
          `${connection.distance.toFixed(2)}m`,
      );
    });

    // --------------------
    // BUILD POI EDGES
    // --------------------

    const poiEdges = buildPoiEdges(poiConnections);

    console.log("POI EDGES");

    poiEdges.forEach((edge) => {
      console.log(`${edge.from} → ${edge.to} | ${edge.distance.toFixed(2)}m`);
    });

    // --------------------
    // TEST DIJKSTRA
    // --------------------

    const startPoi = "B008"; // Centenary Gate
    const endPoi = "B003"; // CS Dept

    // Find graph connection for each POI
    const startConnection = poiConnections.find(
      (connection) => connection.poiId === startPoi,
    );

    const endConnection = poiConnections.find(
      (connection) => connection.poiId === endPoi,
    );

    console.log("START CONNECTION:", startConnection);
    console.log("END CONNECTION:", endConnection);

    if (!startConnection || !endConnection) {
      console.error("Could not find start or end POI.");
    } else {
      const startNodeId = startConnection.nodeId;
      const endNodeId = endConnection.nodeId;

      console.log("START NODE:", startNodeId);
      console.log("END NODE:", endNodeId);

      const result = dijkstra(nodes, edges, startNodeId, endNodeId);

      console.log("ROUTE RESULT");
      console.log(result);

      if (result) {
        // Convert graph node IDs → Leaflet coordinates
        drawRoute(result.path, nodes);

        // Find actual POIs
        const startPoiFeature = pois.features.find(
          (feature) => feature.properties.id === startPoi,
        );

        const endPoiFeature = pois.features.find(
          (feature) => feature.properties.id === endPoi,
        );

        // Start marker
        L.marker([
          startPoiFeature.geometry.coordinates[1],
          startPoiFeature.geometry.coordinates[0],
        ])
          .addTo(map)
          .bindPopup(
            `<strong>Start:</strong> ${startPoiFeature.properties.name}`,
          );

        // End marker
        L.marker([
          endPoiFeature.geometry.coordinates[1],
          endPoiFeature.geometry.coordinates[0],
        ])
          .addTo(map)
          .bindPopup(
            `<strong>Destination:</strong> ${endPoiFeature.properties.name}`,
          );
      }
    }

    // --------------------
    // GRAPH NODES
    // --------------------

    console.log("GRAPH NODES");

    nodes.forEach((node) => {
      console.log(
        `${node.id} | ${node.type} | ` +
          `${node.coordinate.join(", ")} | ` +
          `Paths: ${node.connectedPaths.join(", ")}`,
      );
    });

    // --------------------
    // GRAPH EDGES
    // --------------------

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
