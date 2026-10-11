export type Coordinates = { lat: number; lng: number };
export type GoogleListener = { remove(): void };
export type GoogleMap = { getZoom(): number | undefined; setZoom(zoom: number): void; setCenter(center: Coordinates): void; fitBounds(bounds: GoogleBounds, padding?: number): void; addListener(name: string, handler: () => void): GoogleListener };
export type GoogleBounds = { extend(point: Coordinates): void };
export type GoogleCircle = { setMap(map: GoogleMap | null): void; setRadius(radius: number): void; addListener(name: string, handler: () => void): GoogleListener };
export type GoogleInfoWindow = { setContent(content: HTMLElement): void; setPosition(position: Coordinates): void; open(options: { map: GoogleMap; shouldFocus: boolean }): void; close(): void };
export type GoogleMapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
  Circle: new (options: Record<string, unknown>) => GoogleCircle;
  InfoWindow: new () => GoogleInfoWindow;
  LatLngBounds: new () => GoogleBounds;
  event: { clearInstanceListeners(instance: unknown): void };
};
type GoogleWindow = Window & { google?: { maps?: GoogleMapsApi }; gm_authFailure?: () => void; [key: string]: unknown };
let pending: Promise<GoogleMapsApi> | null = null;
let sequence = 0;
export function googleFleetKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY?.trim() || "";
}
export const googleMapError = "Google Maps could not load. Check that Maps JavaScript API is enabled for the website key and this website is allowed. Location details remain below.";
export function loadGoogleFleetMaps(): Promise<GoogleMapsApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps needs a browser."));
  const win = window as unknown as GoogleWindow;
  if (win.google?.maps?.Map && win.google.maps.Circle) return Promise.resolve(win.google.maps);
  if (pending) return pending;
  const key = googleFleetKey();
  if (!key) return Promise.reject(new Error("Google Maps is not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to a website key with Maps JavaScript API enabled."));
  pending = new Promise<GoogleMapsApi>((resolve, reject) => {
    const callback = `__streamlineFleetMapReady${++sequence}`;
    const script = document.createElement("script");
    const previousAuthFailure = win.gm_authFailure;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return; settled = true; window.clearTimeout(timer);
      win[callback] = () => {};
      if (error) { script.remove(); reject(error); }
      else if (win.google?.maps) resolve(win.google.maps);
      else reject(new Error(googleMapError));
    };
    const timer = window.setTimeout(() => finish(new Error(googleMapError)), 20000);
    win[callback] = () => win.google?.maps?.Map ? finish() : finish(new Error(googleMapError));
    win.gm_authFailure = () => {
      window.dispatchEvent(new Event("streamline-google-maps-auth-error"));
      finish(new Error(googleMapError));
      previousAuthFailure?.();
    };
    const params = new URLSearchParams({ key, callback, loading: "async", v: "quarterly", region: "GB", language: "en", auth_referrer_policy: "origin" });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true; script.referrerPolicy = "strict-origin-when-cross-origin";
    const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
    if (nonce) script.nonce = nonce;
    script.onerror = () => finish(new Error(googleMapError));
    document.head.appendChild(script);
  }).catch(error => { pending = null; throw error; });
  return pending;
}
export function fleetPointRadius(latitude: number, zoom: number) {
  return 9 * 156543.03392 * Math.cos(latitude * Math.PI / 180) / 2 ** zoom;
}

