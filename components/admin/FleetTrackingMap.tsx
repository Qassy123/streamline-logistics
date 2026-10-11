"use client";
import { useEffect, useRef, useState } from "react";
import { fleetPointRadius, googleMapError, loadGoogleFleetMaps, type GoogleMap, type GoogleMapsApi, type GoogleCircle, type GoogleInfoWindow, type GoogleListener } from "@/lib/googleFleetMaps";
export type FleetMapPoint = { id: string; label: string; latitude: number; longitude: number; live: boolean; accuracy: number | null; capturedAt: string };
export default function FleetTrackingMap({ points }: { points: FleetMapPoint[] }) {
  const element = useRef<HTMLDivElement>(null), map = useRef<GoogleMap | null>(null), api = useRef<GoogleMapsApi | null>(null), popup = useRef<GoogleInfoWindow | null>(null);
  const circles = useRef<GoogleCircle[]>([]), listeners = useRef<GoogleListener[]>([]), fitted = useRef(false), latestPoints = useRef(points);
  latestPoints.current = points;
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  function clearPoints() {
    listeners.current.forEach(listener => listener.remove()); listeners.current = [];
    circles.current.forEach(circle => { api.current?.event.clearInstanceListeners(circle); circle.setMap(null); }); circles.current = [];
    popup.current?.close();
  }
  function fitLocations() {
    if (!api.current || !map.current) return;
    const valid = latestPoints.current.filter(validPoint);
    if (!valid.length) return;
    if (valid.length === 1) { map.current.setCenter({ lat: valid[0].latitude, lng: valid[0].longitude }); map.current.setZoom(13); }
    else { const bounds = new api.current.LatLngBounds(); valid.forEach(p => bounds.extend({ lat: p.latitude, lng: p.longitude })); map.current.fitBounds(bounds, 40); }
    fitted.current = true;
  }
  useEffect(() => {
    let cancelled = false;
    const authFailed = () => { setError(googleMapError); setReady(false); clearPoints(); };
    window.addEventListener("streamline-google-maps-auth-error", authFailed);
    void loadGoogleFleetMaps().then(maps => {
      if (cancelled || !element.current) return;
      api.current = maps;
      map.current = new maps.Map(element.current, { center: { lat: 54.5, lng: -3 }, zoom: 5, mapTypeId: "roadmap", gestureHandling: "cooperative", streetViewControl: false, fullscreenControl: true, mapTypeControl: true, clickableIcons: false });
      popup.current = new maps.InfoWindow(); setReady(true); setError("");
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : googleMapError); });
    return () => {
      cancelled = true; window.removeEventListener("streamline-google-maps-auth-error", authFailed); clearPoints();
      if (map.current) api.current?.event.clearInstanceListeners(map.current);
      if (popup.current) api.current?.event.clearInstanceListeners(popup.current);
      element.current?.replaceChildren(); map.current = null; popup.current = null; api.current = null; fitted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current || !api.current) return;
    clearPoints();
    const currentMap = map.current, maps = api.current;
    const dots: { circle: GoogleCircle; latitude: number }[] = [];
    for (const p of points.filter(validPoint)) {
      const position = { lat: p.latitude, lng: p.longitude }, color = p.live ? "#006CFF" : "#b45309";
      const circle = new maps.Circle({ map: currentMap, center: position, radius: fleetPointRadius(p.latitude, currentMap.getZoom() || 5), strokeColor: "#ffffff", strokeWeight: 2, fillColor: color, fillOpacity: 1, clickable: true, zIndex: 2 });
      circles.current.push(circle); dots.push({ circle, latitude: p.latitude });
      listeners.current.push(circle.addListener("click", () => {
        const content = document.createElement("div");
        content.textContent = `${p.label} · ${p.live ? "Recent phone GPS" : "Last known / stale"} · ${new Date(p.capturedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}`;
        popup.current?.setContent(content); popup.current?.setPosition(position); popup.current?.open({ map: currentMap, shouldFocus: false });
      }));
      if (p.live && p.accuracy != null && Number.isFinite(p.accuracy) && p.accuracy > 0) {
        circles.current.push(new maps.Circle({ map: currentMap, center: position, radius: Math.min(p.accuracy, 100000), strokeColor: color, strokeWeight: 1, fillColor: color, fillOpacity: 0.08, clickable: false, zIndex: 1 }));
      }
    }
    listeners.current.push(currentMap.addListener("zoom_changed", () => dots.forEach(dot => dot.circle.setRadius(fleetPointRadius(dot.latitude, currentMap.getZoom() || 5)))));
    if (!fitted.current) fitLocations();
    return clearPoints;
  }, [points, ready]);
  return <div className="space-y-2">
    <div className="relative"><div ref={element} className="relative z-0 h-[360px] w-full rounded-xl border sm:h-[440px]" aria-label="Google fleet map: blue recent phone locations, amber last known locations" />
      {!ready && <div className="absolute inset-0 grid place-items-center rounded-xl bg-slate-50 p-6 text-center"><p role={error ? "alert" : "status"}>{error || "Loading Google Maps…"}</p></div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-600">Google Maps · Blue: recent phone GPS. Amber: last known location. Accuracy circles show the phone’s reported uncertainty.</p><button type="button" onClick={fitLocations} disabled={!ready || !points.some(validPoint)} className="min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50">Show all locations</button></div>
    {error && points.filter(validPoint).length > 0 && <div className="flex flex-wrap gap-2">{points.filter(validPoint).map(p => <a key={p.id} className="inline-flex min-h-11 items-center rounded-xl border px-3 text-sm text-blue-700" href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`} target="_blank" rel="noopener noreferrer">{p.label}: open in Google Maps</a>)}</div>}
  </div>;
}
function validPoint(point: FleetMapPoint) { return Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180; }
