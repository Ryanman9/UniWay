import {
  buildNodes,
  buildEdges,
  checkGraphConnectivity,
  buildPoiNodes,
  connectPoiToGraph,
} from "./graph.js";

import { findRoute } from "./routing.js";

// ============================================================
// CONFIG
// ============================================================

const MAPTILER_KEY = "y3k27rR8H6hT3sAesswC";

const START_POI_NAME = "CS Dept";
const END_POI_NAME = "Mathematics Dept";

const ROUTE_MODE = "vehicle";

const ROUTE_COLORS = {
  vehicle: "#2263f0",
  pedestrian: "#60a5fa",
  marker: "#eb3838",
};

// ============================================================
// MAP
// ============================================================

const CUSTOM_MAP_ID = "01a03944-5ece-74e2-b8c1-56e3a2c22fdf";

const map = new maplibregl.Map({
  container: "map",

  style: `https://api.maptiler.com/maps/${CUSTOM_MAP_ID}/style.json?key=${MAPTILER_KEY}`,

  center: [78.074, 27.916],

  zoom: 17,

  bearing: 0,

  pitch: 0,

  attributionControl: true,
});

// ============================================================
// HELPERS
// ============================================================

function findPoiByName(pois, searchText) {
  const query = searchText.trim().toLowerCase();

  return pois.features.find((feature) => {
    const name = feature.properties?.name;

    return name?.trim().toLowerCase() === query;
  });
}

// ============================================================
// CREATE ROUTE GEOJSON
// ============================================================

function createRouteGeoJSON(route) {
  const vehicleLines = [];
  const pedestrianLines = [];

  route.segments.forEach((segment) => {
    if (!segment.edges || segment.edges.length === 0) {
      return;
    }

    segment.edges.forEach((edge) => {
      if (!edge.coordinates || edge.coordinates.length < 2) {
        console.warn("Edge has no geometry:", edge.from, edge.to);

        return;
      }

      // Keep every edge as its own LineString
      if (segment.mode === "vehicle") {
        vehicleLines.push(edge.coordinates);
      }

      if (segment.mode === "pedestrian") {
        pedestrianLines.push(edge.coordinates);
      }
    });
  });

  return {
    type: "FeatureCollection",

    features: [
      {
        type: "Feature",

        properties: {
          mode: "vehicle",
        },

        geometry: {
          type: "MultiLineString",
          coordinates: vehicleLines,
        },
      },

      {
        type: "Feature",

        properties: {
          mode: "pedestrian",
        },

        geometry: {
          type: "MultiLineString",
          coordinates: pedestrianLines,
        },
      },
    ],
  };
}

// ============================================================
// DRAW ROUTE
// ============================================================

function drawRoute(route) {
  const routeGeoJSON = createRouteGeoJSON(route);

  // ----------------------------------------------------------
  // Remove previous route
  // ----------------------------------------------------------

  if (map.getLayer("route-vehicle")) {
    map.removeLayer("route-vehicle");
  }

  if (map.getLayer("route-pedestrian")) {
    map.removeLayer("route-pedestrian");
  }

  if (map.getSource("route")) {
    map.removeSource("route");
  }

  // ----------------------------------------------------------
  // Add route source
  // ----------------------------------------------------------

  map.addSource("route", {
    type: "geojson",
    data: routeGeoJSON,
  });

  // ----------------------------------------------------------
  // Vehicle route
  // ----------------------------------------------------------

  map.addLayer({
    id: "route-vehicle",

    type: "line",

    source: "route",

    filter: ["==", ["get", "mode"], "vehicle"],

    layout: {
      "line-join": "round",
      "line-cap": "round",
    },

    paint: {
      "line-color": ROUTE_COLORS.vehicle,

      "line-width": 7,

      "line-opacity": 0.95,
    },
  });

  // ----------------------------------------------------------
  // Pedestrian route
  // ----------------------------------------------------------

  map.addLayer({
    id: "route-pedestrian",

    type: "line",

    source: "route",

    filter: ["==", ["get", "mode"], "pedestrian"],

    layout: {
      "line-join": "round",
      "line-cap": "round",
    },

    paint: {
      "line-color": ROUTE_COLORS.pedestrian,

      "line-width": 5,

      "line-opacity": 0.95,

      "line-dasharray": [1.5, 1.5],
    },
  });
}

function createNavigationMarker(coordinate, label) {
  const el = document.createElement("div");

  el.className = "navigation-marker";

  el.innerHTML = `
    <div class="navigation-marker-dot"></div>
  `;

  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: true,
    offset: 14,
    className: "navigation-popup",
  }).setText(label);

  const marker = new maplibregl.Marker({
    element: el,
    anchor: "center",
  })
    .setLngLat(coordinate)
    .setPopup(popup)
    .addTo(map);

  return marker;
}

let startMarker = null;
let destinationMarker = null;

function drawNavigationMarkers(startPoi, endPoi) {
  if (startMarker) {
    startMarker.remove();
  }

  if (destinationMarker) {
    destinationMarker.remove();
  }

  startMarker = createNavigationMarker(
    startPoi.geometry.coordinates,
    `Start: ${startPoi.properties.name}`,
  );

  destinationMarker = createNavigationMarker(
    endPoi.geometry.coordinates,
    `Destination: ${endPoi.properties.name}`,
  );
}

// ============================================================
// DRAW POIs
// ============================================================

function drawPOIs(pois) {
  if (map.getLayer("pois")) {
    map.removeLayer("pois");
  }

  if (map.getSource("pois")) {
    map.removeSource("pois");
  }

  map.addSource("pois", {
    type: "geojson",
    data: pois,
  });

  map.addLayer({
    id: "pois",

    type: "circle",

    source: "pois",

    paint: {
      "circle-radius": 5,

      "circle-color": "#ffffff",

      "circle-stroke-color": "#555555",

      "circle-stroke-width": 2,
    },
  });
}

// ============================================================
// DISPLAY ROUTE INFO
// ============================================================

function logRouteInfo(route, startPoi, endPoi) {
  console.log("========== ROUTE ==========");

  console.log(`${startPoi.properties.name} → ${endPoi.properties.name}`);

  console.log("Start vehicle node:", route.startVehicleNode);

  console.log("End vehicle node:", route.endVehicleNode);

  console.log("Total distance:", `${route.totalDistance.toFixed(2)}m`);

  console.log("========== SEGMENTS ==========");

  route.segments.forEach((segment, index) => {
    console.log(`SEGMENT ${index + 1}`);

    console.log("MODE:", segment.mode);

    console.log("PATH:", segment.path);
  });
}

// ============================================================
// LOAD DATA
// ============================================================

async function loadData() {
  try {
    const [paths, pois] = await Promise.all([
      fetch("./data/paths.json").then((response) => response.json()),

      fetch("./data/pois.json").then((response) => response.json()),
    ]);

    console.log("Paths loaded:", paths.features.length);

    console.log("POIs loaded:", pois.features.length);

    // --------------------------------------------------------
    // Build graph
    // --------------------------------------------------------

    const nodes = buildNodes(paths);

    const edges = buildEdges(paths, nodes);

    console.log("Nodes:", nodes.length);

    console.log("Edges:", edges.length);

    checkGraphConnectivity(nodes, edges);

    // --------------------------------------------------------
    // Build POI graph connections
    // --------------------------------------------------------

    const poiNodes = buildPoiNodes(pois, nodes);

    const poiConnections = connectPoiToGraph(poiNodes, nodes);

    console.log("POI connections:", poiConnections);

    // --------------------------------------------------------
    // Draw POIs
    // --------------------------------------------------------

    drawPOIs(pois);

    // --------------------------------------------------------
    // Find start and destination
    // --------------------------------------------------------

    const startPoi = findPoiByName(pois, START_POI_NAME);

    const endPoi = findPoiByName(pois, END_POI_NAME);

    if (!startPoi) {
      console.error(`Start POI not found: "${START_POI_NAME}"`);

      return;
    }

    if (!endPoi) {
      console.error(`Destination POI not found: "${END_POI_NAME}"`);

      return;
    }

    console.log("Start:", startPoi.properties.name);

    console.log("Destination:", endPoi.properties.name);

    // --------------------------------------------------------
    // Find route
    // --------------------------------------------------------

    const route = findRoute(
      startPoi.properties.id,

      endPoi.properties.id,

      poiConnections,

      nodes,

      edges,

      ROUTE_MODE,
    );

    if (!route) {
      console.error("No route found.");

      return;
    }

    // --------------------------------------------------------
    // Log route
    // --------------------------------------------------------

    logRouteInfo(route, startPoi, endPoi);

    // --------------------------------------------------------
    // Draw route
    // --------------------------------------------------------

    drawRoute(route);

    // --------------------------------------------------------
    // Draw navigation markers
    // --------------------------------------------------------

    drawNavigationMarkers(startPoi, endPoi);
  } catch (error) {
    console.error("Application error:", error);
  }
}

// ============================================================
// MAP READY
// ============================================================

map.on("load", () => {
  console.log("Map loaded.");

  loadData();
});
