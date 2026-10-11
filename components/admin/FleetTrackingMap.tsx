"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
export type FleetMapPoint = { id: string; label: string; latitude: number; longitude: number; live: boolean; accuracy: number | null; capturedAt: string };
export default function FleetTrackingMap({ points }: { points: FleetMapPoint[] }) {
  const element = useRef<HTMLDivElement>(null), map = useRef<LeafletMap | null>(null), group = useRef<LayerGroup | null>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const fitted = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then(L => {
      if (cancelled || !element.current) return;
      map.current = L.map(element.current, { scrollWheelZoom: false }).setView([54.5, -3], 5);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19 }).addTo(map.current);
      group.current = L.layerGroup().addTo(map.current); setReady(true);
    }).catch(() => setError("Map could not load. Locations remain available in the list below."));
    return () => { cancelled = true; map.current?.remove(); map.current = null; group.current = null; fitted.current = false; };
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!ready || !map.current || !group.current) return;
    void import("leaflet").then(L => {
      if (cancelled || !map.current || !group.current) return;
      group.current.clearLayers();
      const valid = points.filter(p => Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180);
      for (const p of valid) {
        const popup = document.createElement("div");
        popup.textContent = `${p.label} · ${p.live ? "Recent phone GPS" : "Last known / stale"} · ${new Date(p.capturedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}`;
        L.circleMarker([p.latitude, p.longitude], { radius: 9, color: p.live ? "#006CFF" : "#b45309", fillOpacity: 0.85 }).bindPopup(popup).addTo(group.current);
        if (p.live && p.accuracy != null && Number.isFinite(p.accuracy) && p.accuracy > 0) L.circle([p.latitude, p.longitude], { radius: Math.min(p.accuracy, 100000), weight: 1, fillOpacity: 0.08 }).addTo(group.current);
      }
      if (valid.length && !fitted.current) { map.current.fitBounds(L.latLngBounds(valid.map(p => [p.latitude, p.longitude] as [number, number])), { padding: [30, 30], maxZoom: 13 }); fitted.current = true; }
      map.current.invalidateSize();
    });
    return () => { cancelled = true; };
  }, [points, ready]);
  return <div className="space-y-2"><div ref={element} className="relative z-0 h-[360px] w-full rounded-xl border sm:h-[440px]" aria-label="Fleet map: blue recent phone locations, amber last known locations" />{error && <p role="alert">{error}</p>}<p className="text-xs text-slate-600">Blue: recent phone GPS. Amber: last known location. Accuracy circles show the phone’s reported uncertainty. Map tiles provided by OpenStreetMap.</p></div>;
}
