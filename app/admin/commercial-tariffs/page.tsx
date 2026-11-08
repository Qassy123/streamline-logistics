"use client";

import { useEffect, useState, type FormEvent } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { useAdminSession } from "@/components/admin/AdminSession";

const endpoint = "/api/admin/commercial-tariffs";
const fieldClass = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50";
const buttonClass = "min-h-11 rounded-lg bg-[#E55300] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const rateFields = [
  { key: "fare8Hours", label: "8-hour fare (£)" },
  { key: "includedMiles8", label: "8-hour included miles" },
  { key: "fare12Hours", label: "12-hour fare (£)" },
  { key: "includedMiles12", label: "12-hour included miles" },
  { key: "extraMileRate", label: "Extra mileage (£/mile)" },
] as const;

type Rate = { vehicleType: string } & Record<(typeof rateFields)[number]["key"], string>;
type Tariff = { id: string; name: string; rates: Rate[] };

async function request<T>(path = "", options?: RequestInit): Promise<T> {
  const response = await adminFetch(endpoint + path, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Unable to manage commercial tariffs.");
  return data;
}

export default function CommercialTariffsPage() {
  const { admin } = useAdminSession();
  const canEdit = admin.role !== "READ_ONLY";
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void request<{ tariffs: Tariff[]; vehicleTypes: string[] }>("", { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setTariffs(data.tariffs);
        setVehicleTypes(data.vehicleTypes);
        setSelectedId(data.tariffs[0]?.id || "");
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const { tariff } = await request<{ tariff: Tariff }>("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      setTariffs(current => [...current, tariff].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedId(tariff.id);
      setNewName("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to add the tariff.");
    } finally {
      setCreating(false);
    }
  }

  const selected = tariffs.find(tariff => tariff.id === selectedId);

  return (
    <main className="mx-auto max-w-[1350px] space-y-6 px-4 py-8 sm:px-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Admin pricing</p>
        <h1 className="mt-1 text-3xl font-bold">Commercial Tariffs</h1>
        <p className="mt-2 text-sm text-slate-600">Set shift fares and included mileage for each van. The extra mileage rate applies only above the included miles.</p>
      </header>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p role="status">Loading commercial tariffs…</p> : (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <label className="block min-w-52 text-sm font-semibold">
              Tariff category
              <select className={fieldClass + " mt-1"} value={selectedId} onChange={event => setSelectedId(event.target.value)}>
                {!tariffs.length && <option value="">No tariffs available</option>}
                {tariffs.map(tariff => <option key={tariff.id} value={tariff.id}>{tariff.name}</option>)}
              </select>
            </label>
            {canEdit && (
              <form onSubmit={addCategory} className="flex flex-wrap items-end gap-2">
                <label className="block text-sm font-semibold">
                  New category name
                  <input className={fieldClass + " mt-1"} value={newName} maxLength={60} required
                    onChange={event => setNewName(event.target.value)} />
                </label>
                <button className={buttonClass} disabled={creating || !newName.trim()}>
                  {creating ? "Adding…" : "Add category"}
                </button>
              </form>
            )}
          </div>

          {selected && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <caption className="sr-only">{selected.name} rates by van and shift length</caption>
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th scope="col" className="px-3 py-3">Van</th>
                    {rateFields.map(field => <th key={field.key} scope="col" className="px-2 py-3">{field.label}</th>)}
                    {canEdit && <th scope="col" className="px-3 py-3">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {vehicleTypes.map((vehicleType, index) => (
                    <VanRateRow key={selected.id + vehicleType} tariffId={selected.id} vehicleType={vehicleType}
                      formId={`commercial-rate-${index}`} canEdit={canEdit}
                      rate={selected.rates.find(rate => rate.vehicleType === vehicleType)}
                      onSaved={rate => setTariffs(current => current.map(tariff => tariff.id === selected.id
                        ? { ...tariff, rates: [...tariff.rates.filter(row => row.vehicleType !== rate.vehicleType), rate] }
                        : tariff))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function VanRateRow({
  tariffId, vehicleType, formId, canEdit, rate, onSaved,
}: {
  tariffId: string;
  vehicleType: string;
  formId: string;
  canEdit: boolean;
  rate?: Rate;
  onSaved: (rate: Rate) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const { rate } = await request<{ rate: Rate }>(`/${encodeURIComponent(tariffId)}/rates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleType, ...fields }),
      });
      onSaved(rate);
      setSaved(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save this van’s rates.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-slate-200 align-top">
      <th scope="row" className="px-3 py-4 font-semibold">{vehicleType}</th>
      {rateFields.map(field => (
        <td key={field.key} className="min-w-28 px-2 py-2">
          {canEdit ? (
            <input type="number" min="0" max="9999999999.99" step="0.01" required form={formId} name={field.key}
              defaultValue={rate?.[field.key] || ""} aria-label={`${vehicleType}: ${field.label}`}
              onChange={() => { if (saved) setSaved(false); }} className={fieldClass} readOnly={saving} />
          ) : rate?.[field.key] ?? "—"}
        </td>
      ))}
      {canEdit && (
        <td className="min-w-28 px-3 py-2">
          <form id={formId} onSubmit={saveRate}>
            <button className={buttonClass} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            {saved && <p role="status" className="mt-1 text-xs text-green-700">Saved</p>}
            {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
          </form>
        </td>
      )}
    </tr>
  );
}
