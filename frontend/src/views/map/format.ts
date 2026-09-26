export function formatDistance(meters: number): string {
  if (meters < 1) return "";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "--";

  const minutes = Math.round(seconds / 60);

  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;

  return `${hours} h ${remMinutes} min`;
}

export function poiLabel(feature: any): string {
  return feature.properties?.name ?? "Unnamed";
}

export function findPoiByName(pois: any, searchText: string): any {
  const query = searchText.trim().toLowerCase();

  return pois.features.find((feature: any) => {
    const name = feature.properties?.name;
    return name?.trim().toLowerCase() === query;
  });
}
