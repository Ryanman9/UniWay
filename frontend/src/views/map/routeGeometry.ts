import { calculateDistance } from "../../graph";

export function createRouteGeoJSON(route: any) {
  const vehicleCoordinates: any[] = [];
  const pedestrianCoordinates: any[] = [];

  route.segments.forEach((segment: any) => {
    if (!segment.edges || segment.edges.length === 0) {
      return;
    }

    const coordinates: any[] = [];

    segment.edges.forEach((edge: any) => {
      if (!edge.coordinates || edge.coordinates.length < 2) {
        return;
      }

      if (coordinates.length === 0) {
        coordinates.push(...edge.coordinates);
      } else {
        const last = coordinates[coordinates.length - 1];
        const first = edge.coordinates[0];

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

export function createRemainingRouteGeoJSON(route: any, distanceAlongRoute: number) {
  const vehicleCoordinates: any[] = [];
  const pedestrianCoordinates: any[] = [];

  let cumulative = 0;

  route.segments.forEach((segment: any) => {
    if (!segment.edges || segment.edges.length === 0) return;

    const segCoords: any[] = [];
    segment.edges.forEach((edge: any) => {
      if (!edge.coordinates || edge.coordinates.length < 2) return;

      edge.coordinates.forEach((c: any) => {
        const last = segCoords[segCoords.length - 1];
        if (last && last[0] === c[0] && last[1] === c[1]) return;
        segCoords.push(c);
      });
    });

    if (segCoords.length < 2) return;

    const remaining: any[] = [];

    for (let i = 0; i < segCoords.length - 1; i++) {
      const a = segCoords[i];
      const b = segCoords[i + 1];
      const segLen = calculateDistance(a, b);

      const startDist = cumulative;
      const endDist = cumulative + segLen;

      if (endDist > distanceAlongRoute) {
        if (remaining.length === 0) {

          if (startDist >= distanceAlongRoute) {
            remaining.push(a);
          } else {
            const t =
              segLen === 0 ? 0 : (distanceAlongRoute - startDist) / segLen;
            remaining.push([
              a[0] + t * (b[0] - a[0]),
              a[1] + t * (b[1] - a[1]),
            ]);
          }
        }
        remaining.push(b);
      }

      cumulative = endDist;
    }

    if (remaining.length >= 2) {
      if (segment.mode === "vehicle") vehicleCoordinates.push(remaining);
      if (segment.mode === "pedestrian") pedestrianCoordinates.push(remaining);
    }
  });

  return {
    type: "FeatureCollection",

    features: [
      {
        type: "Feature",
        properties: { mode: "vehicle" },
        geometry: { type: "MultiLineString", coordinates: vehicleCoordinates },
      },
      {
        type: "Feature",
        properties: { mode: "pedestrian" },
        geometry: {
          type: "MultiLineString",
          coordinates: pedestrianCoordinates,
        },
      },
    ],
  };
}
