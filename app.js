const map = L.map("map").setView([27.916, 78.074], 17);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

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

    const poiConnections = connectPoiToGraph(poiNodes, nodes);

    console.log("POI CONNECTIONS");

    poiConnections.forEach((connection) => {
      console.log(
        `${connection.poiName} (${connection.poiId}) → ` +
          `${connection.nodeId} | ` +
          `${connection.distance.toFixed(2)}m`,
      );
    });

    const poiEdges = buildPoiEdges(poiConnections);

    console.log("POI EDGES");

    poiEdges.forEach((edge) => {
      console.log(
        `${edge.from} → ${edge.to} | ` + `${edge.distance.toFixed(2)}m`,
      );
    });

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
