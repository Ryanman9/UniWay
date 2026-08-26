# UniWay mobile

A native React Native campus navigation app. It renders MapTiler styles using MapLibre React Native, tracks device GPS through the native geolocation bridge, and routes across the bundled campus GeoJSON graph.

## Run

```sh
npm install
npm start
npm run android
# or: cd ios && pod install && cd .. && npm run ios
```

On Android, grant precise location permission when prompted. The app uses high-accuracy updates with a 5 m distance filter and clears the native watch when the screen unmounts.

## Architecture

- `src/routing`: DOM-free graph building, Haversine distance calculation, Dijkstra routing, and GeoJSON route creation.
- `src/map`: native MapLibre `MapView`, `Camera`, `ShapeSource`, `LineLayer`, and `PointAnnotation` rendering.
- `src/hooks`: permission-aware GPS location lifecycle.
