"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeftRight, ArrowUpDown, Boxes, Phone, Ruler, Scale, Truck, X } from "lucide-react";
import { vehicleDetails } from "@/lib/vehicleDetails";

export default function VehicleDetailsModal({ vehicleName, onClose, admin = false }: {
  vehicleName: string;
  onClose: () => void;
  admin?: boolean;
}) {
  const vehicle = vehicleDetails[vehicleName];
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const descriptionId = useId();
  const [compare, setCompare] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!vehicle) return;
    const element = dialog.current;
    if (!element) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = originalOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [vehicle]);

  if (!vehicle) return null;
  const accent = admin ? "bg-[#FF6A00] hover:bg-[#E55300]" : "bg-[#006CFF] hover:bg-[#0059D6]";
  const dimensions = [
    { label: "Internal length", value: vehicle.length, icon: Ruler },
    { label: "Internal width", value: vehicle.width, icon: ArrowLeftRight },
    { label: "Internal height", value: vehicle.height, icon: ArrowUpDown },
  ];

  return <dialog ref={dialog} aria-labelledby={headingId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); closeRef.current(); }}
    onClick={event => { if (event.target === event.currentTarget) closeRef.current(); }}
    className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-4xl overflow-hidden rounded-3xl border-0 bg-white p-0 text-[#071D49] shadow-2xl backdrop:bg-[#020B1F]/70 backdrop:backdrop-blur-sm">
    <div className="flex max-h-[calc(100dvh_-_2rem)] flex-col" onClick={event => event.stopPropagation()}>
      <header className="flex shrink-0 items-start justify-between gap-4 bg-[#071D49] px-5 py-5 text-white sm:px-7">
        <div><p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-300"><Truck size={16} aria-hidden="true" />Vehicle guide</p><h2 id={headingId} className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{vehicle.label}</h2><p id={descriptionId} className="mt-2 text-sm text-blue-100">Load space and carrying capacity</p></div>
        <button autoFocus type="button" aria-label="Close vehicle details" onClick={onClose} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/5 text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"><X size={21} aria-hidden="true" /></button>
      </header>

      <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
        <div className="grid gap-5 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white"><img src={vehicle.image} alt={`${vehicle.label} with Streamline Logistics Group branding`} className="h-48 w-full object-contain p-3 sm:h-64 md:h-72" /></div>
          <div className="space-y-3"><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Carrying capacity</p><dl className="grid grid-cols-2 gap-3 md:grid-cols-1">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><dt className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Boxes size={17} aria-hidden="true" />Pallet spaces</dt><dd className="mt-2 text-[clamp(1rem,4vw,1.5rem)] font-bold sm:text-3xl">{vehicle.pallets}</dd></div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><dt className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Scale size={17} aria-hidden="true" />Maximum load weight</dt><dd className="mt-2 text-[clamp(1rem,4vw,1.5rem)] font-bold sm:text-3xl">{vehicle.maxWeight}</dd></div>
          </dl></div>
        </div>

        <div className="mt-6"><h3 className="text-sm font-bold">Internal load-space dimensions</h3><dl className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">{dimensions.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4"><dt className="flex flex-col gap-2 text-xs font-medium text-slate-500 sm:flex-row sm:items-center"><Icon size={17} className="text-blue-600" aria-hidden="true" />{label}</dt><dd className="mt-2 whitespace-nowrap text-lg font-bold sm:text-2xl">{value}</dd></div>)}</dl></div>
        <p className="mt-4 text-xs leading-5 text-slate-500">These are vehicle-category guides. For a tight-fitting or heavy load, call us to confirm suitability.</p>

        <button type="button" aria-expanded={compare} aria-controls={`${headingId}-comparison`} onClick={() => setCompare(!compare)} className="mt-4 min-h-11 text-sm font-bold text-blue-700 underline underline-offset-4">{compare ? "Hide vehicle comparison" : "Compare all five vehicles"}</button>
        {compare && <div id={`${headingId}-comparison`} className="mt-2 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[570px] text-left text-xs"><caption className="sr-only">Compare internal dimensions, pallet capacity and maximum load weight for the five vehicle categories</caption><thead className="bg-slate-100 text-slate-600"><tr>{["Vehicle", "Length", "Width", "Height", "Pallets", "Max. load"].map(label => <th key={label} scope="col" className="px-3 py-3 font-bold">{label}</th>)}</tr></thead><tbody>{Object.entries(vehicleDetails).map(([name, row]) => <tr key={name} className={`border-t border-slate-100 ${name === vehicleName ? "bg-blue-50" : "bg-white"}`}><th scope="row" className="px-3 py-3 font-semibold">{row.label}{name === vehicleName && <span className="sr-only"> (current vehicle)</span>}</th>{[row.length, row.width, row.height, row.pallets, row.maxWeight].map((value, index) => <td key={index} className="whitespace-nowrap px-3 py-3">{value}</td>)}</tr>)}</tbody></table></div>}
      </div>

      <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="text-xs text-slate-500">Need help choosing a van?</p><div className="flex flex-wrap gap-2"><button type="button" onClick={onClose} className="min-h-11 rounded-full border border-slate-200 px-5 text-sm font-bold text-[#071D49] hover:bg-slate-50">Back to form</button><a href="tel:03333440703" className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-white transition ${accent}`}><Phone size={16} aria-hidden="true" />0333 344 0703</a></div>
      </footer>
    </div>
  </dialog>;
}
