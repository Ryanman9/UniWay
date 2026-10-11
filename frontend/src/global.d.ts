declare const maplibregl: any;
declare const __API_BASE_URL__: string;

interface Window {
  Capacitor?: {
    Plugins?: {
      Geolocation?: any;
      KeepAwake?: any;
      [key: string]: any;
    };
  };
}
