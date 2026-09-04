declare const maplibregl: any;

interface Window {
  Capacitor?: {
    Plugins?: {
      Geolocation?: any;
      KeepAwake?: any;
      [key: string]: any;
    };
  };
}
