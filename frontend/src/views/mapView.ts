import { createMap, initLocationBanner } from "./map/mapSetup";
import { initPickerUI } from "./map/pickerUI";
import { initNavigationUI } from "./map/navigationUI";
import { initDevSimulator } from "./map/devSimulator";
import { loadData } from "./map/routingFlow";
import { initLiveLocation } from "./map/mapSetup";
import { state } from "./map/state";

let mapViewInitialized = false;

export function initMapView(): void {
  if (mapViewInitialized) return;
  mapViewInitialized = true;

  createMap();

  initLocationBanner();
  initPickerUI();
  initNavigationUI();
  initDevSimulator();

  state.map.on("load", () => {
    console.log("Map loaded.");

    loadData();
    initLiveLocation();
  });
}
