const map = L.map("map").setView([27.916, 78.074], 17);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// --------------------
// POIs
// --------------------

fetch("./data/pois.json")
  .then((response) => response.json())
  .then((data) => {
    console.log("POIs loaded:", data);

    L.geoJSON(data, {
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
  })
  .catch((error) => {
    console.error("POI ERROR:", error);
  });

// --------------------
// PATHS
// --------------------

fetch("./data/paths.json")
  .then((response) => response.json())
  .then((data) => {
    console.log("Paths loaded:", data);

    const pathLayer = L.geoJSON(data, {
      style: function (feature) {
        return {
          weight: 5,
        };
      },

      onEachFeature: function (feature, layer) {
        const p = feature.properties || {};

        layer.bindPopup(`
                    <strong>${p.name || "Unnamed Path"}</strong><br>
                    ID: ${p.id || "N/A"}<br>
                    Type: ${p.type || "N/A"}
                `);
      },
    }).addTo(map);

    map.fitBounds(pathLayer.getBounds());
  })
  .catch((error) => {
    console.error("PATH ERROR:", error);
  });

fetch("./data/paths.json")
  .then((response) => response.json())
  .then((data) => {
    const coordinateMap = new Map();

    data.features.forEach((feature) => {
      const pathId = feature.properties?.id;
      const coordinates = feature.geometry.coordinates;

      coordinates.forEach((coordinate) => {
        const key = coordinate.join(",");

        if (!coordinateMap.has(key)) {
          coordinateMap.set(key, []);
        }

        coordinateMap.get(key).push(pathId);
      });
    });

    coordinateMap.forEach((paths, coordinate) => {
      if (paths.length > 1) {
        const [lng, lat] = coordinate.split(",").map(Number);

        L.circleMarker([lat, lng], {
          radius: 6,
          weight: 2,
        }).addTo(map).bindPopup(`
                    <strong>Intersection</strong><br>
                    Coordinate: ${coordinate}<br>
                    Connected paths: ${paths.join(", ")}
                `);
      }
    });
  });
