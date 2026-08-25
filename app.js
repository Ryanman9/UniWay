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
  vehicle: "#bdf71e",
  pedestrian: "#bdf71e",
  marker: "#38eb4a",
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
  const vehicleCoordinates = [];
  const pedestrianCoordinates = [];

  route.segments.forEach((segment) => {
    if (!segment.edges || segment.edges.length === 0) {
      return;
    }

    const coordinates = [];

    segment.edges.forEach((edge) => {
      if (!edge.coordinates || edge.coordinates.length < 2) {
        return;
      }

      if (coordinates.length === 0) {
        coordinates.push(...edge.coordinates);
      } else {
        const last = coordinates[coordinates.length - 1];
        const first = edge.coordinates[0];

        // Avoid duplicate coordinate at edge connection
        if (last[0] === first[0] && last[1] === first[1]) {
          coordinates.push(...edge.coordinates.slice(1));
        } else {
          coordinates.push(...edge.coordinates);
        }
      }
    });

    if (coordinates.length < 2) {
      return;
    }

    if (segment.mode === "vehicle") {
      vehicleCoordinates.push(coordinates);
    }

    if (segment.mode === "pedestrian") {
      pedestrianCoordinates.push(coordinates);
    }
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
          coordinates: vehicleCoordinates,
        },
      },

      {
        type: "Feature",

        properties: {
          mode: "pedestrian",
        },

        geometry: {
          type: "MultiLineString",
          coordinates: pedestrianCoordinates,
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

  [
    "route-vehicle-glow",
    "route-vehicle",
    "route-pedestrian-glow",
    "route-pedestrian",
  ].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });

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
  // Vehicle route (soft glow underlay + solid orange line, rounded)
  // ----------------------------------------------------------

  map.addLayer({
    id: "route-vehicle-glow",
    type: "line",
    source: "route",
    filter: ["==", ["get", "mode"], "vehicle"],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#ffffff",
      "line-width": 10,
      "line-opacity": 1,
    },
  });

  map.addLayer({
    id: "route-vehicle",
    type: "line",
    source: "route",
    filter: ["==", ["get", "mode"], "vehicle"],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": ROUTE_COLORS.vehicle,
      "line-width": 6,
      "line-opacity": 1,
    },
  });

  // ----------------------------------------------------------
  // Pedestrian route (dashed orange, same family so the whole
  // route reads as one continuous path like a nav app)
  // ----------------------------------------------------------

  map.addLayer({
    id: "route-pedestrian-glow",
    type: "line",
    source: "route",
    filter: ["==", ["get", "mode"], "pedestrian"],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#ffffff",
      "line-width": 8,
      "line-opacity": 1,
    },
  });

  map.addLayer({
    id: "route-pedestrian",
    type: "line",
    source: "route",
    filter: ["==", ["get", "mode"], "pedestrian"],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": ROUTE_COLORS.pedestrian,
      "line-width": 4,
      "line-opacity": 1,
      "line-dasharray": [2, 1.6],
    },
  });

  // ----------------------------------------------------------
  // Distance card
  // ----------------------------------------------------------

  showDistanceCard(route.totalDistance);
}

function showDistanceCard(totalDistanceMeters) {
  const card = document.getElementById("distance-card");
  const value = document.getElementById("distance-value");

  value.textContent = (totalDistanceMeters / 1000).toFixed(2);
  card.classList.add("visible");
}

function createNavigationMarker(coordinate, label, variant = "end") {
  const el = document.createElement("div");

  if (variant === "start") {
    // Glowing arrow "puck" — mirrors the current-position marker
    // used by nav apps (Uber/Ola style) at the route's origin.
    el.className = "position-puck";
    el.innerHTML = `
      <div class="position-puck-glow"></div>
      <div class="position-puck-arrow">
        <svg viewBox="0 0 24 24" fill="#33ff00"><path d="M12 2 L20 20 L12 16 L4 20 Z"/></svg>
      </div>
    `;
  } else {
    el.className = "navigation-marker";
    el.innerHTML = `<div class="navigation-marker-dot"></div>`;
  }

  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: true,
    offset: 18,
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
    "start",
  );

  destinationMarker = createNavigationMarker(
    endPoi.geometry.coordinates,
    `Destination: ${endPoi.properties.name}`,
    "end",
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
      "circle-color": ["coalesce", ["get", "marker-color"], "#ff8a00"],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
}

// ============================================================
// UI CONTROLS
// ============================================================

document.getElementById("back-btn")?.addEventListener("click", () => {
  history.length > 1 ? history.back() : window.close();
});

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
