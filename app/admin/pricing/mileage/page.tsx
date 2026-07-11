"use client";

import { Loader2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:5000";

type MileageBand = {
  id: string;
  minimumMiles: string;
  maximumMiles: string | null;
  ratePerMile: string;
};

type Tariff = {
  id: string;
  name: string;
  vehicleType: string;
  active: boolean;
  mileageBands: MileageBand[];
};

type FormState = {
  tariffId: string;
  minimumMiles: string;
  maximumMiles: string;
  ratePerMile: string;
};

const emptyForm: FormState = {
  tariffId: "",
  minimumMiles: "0",
  maximumMiles: "",
  ratePerMile: "",
};

export default function MileagePage() {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<MileageBand | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const getAdminKey = useCallback(
    () => window.localStorage.getItem("streamline_admin_key") || "",
    [],
  );

  const loadTariffs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/tariffs`, {
        headers: { "x-admin-key": getAdminKey() },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load tariffs.");
      }

      setTariffs(data.tariffs);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load tariffs.",
      );
    } finally {
      setLoading(false);
    }
  }, [getAdminKey]);

  useEffect(() => {
    void loadTariffs();
  }, [loadTariffs]);

  function openCreate(tariffId?: string) {
    setEditing(null);
    setForm({
      ...emptyForm,
      tariffId: tariffId || tariffs[0]?.id || "",
    });
    setModalOpen(true);
  }

  function openEdit(tariffId: string, band: MileageBand) {
    setEditing(band);
    setForm({
      tariffId,
      minimumMiles: band.minimumMiles,
      maximumMiles: band.maximumMiles || "",
      ratePerMile: band.ratePerMile,
    });
    setModalOpen(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        editing
          ? `${API_BASE_URL}/api/admin/tariffs/mileage-bands/${editing.id}`
          : `${API_BASE_URL}/api/admin/tariffs/${form.tariffId}/mileage-bands`,
        {
          method: editing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey(),
          },
          body: JSON.stringify({
            minimumMiles: Number(form.minimumMiles),
            maximumMiles:
              form.maximumMiles.trim() === ""
                ? null
                : Number(form.maximumMiles),
            ratePerMile: Number(form.ratePerMile),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save mileage band.");
      }

      setModalOpen(false);
      setSuccessMessage(editing ? "Mileage band updated." : "Mileage band added.");
      await loadTariffs();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save mileage band.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeBand(band: MileageBand) {
    if (!window.confirm("Delete this mileage band?")) return;

    setWorkingId(band.id);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/tariffs/mileage-bands/${band.id}`,
        {
          method: "DELETE",
          headers: { "x-admin-key": getAdminKey() },
        },
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete mileage band.");
      }

      setSuccessMessage("Mileage band deleted.");
      await loadTariffs();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete mileage band.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Pricing
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Mileage bands</h1>
          <p className="mt-2 text-sm text-slate-600">
            Define distance ranges and price-per-mile values for each tariff.
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-4 py-3 text-sm font-bold text-white"
        >
          <Plus size={18} />
          Add mileage band
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <button
        onClick={() => void loadTariffs()}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold"
      >
        <RefreshCw size={17} />
        Refresh
      </button>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
          <Loader2 className="mx-auto animate-spin text-[#FF6A00]" />
        </div>
      ) : (
        <div className="space-y-5">
          {tariffs.map((tariff) => (
            <section
              key={tariff.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div>
                  <h2 className="font-bold text-slate-950">{tariff.name}</h2>
                  <p className="text-sm text-slate-500">{tariff.vehicleType}</p>
                </div>
                <button
                  onClick={() => openCreate(tariff.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                >
                  <Plus size={16} />
                  Add band
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-white">
                    <tr>
                      {["Minimum miles", "Maximum miles", "Rate per mile", "Actions"].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-slate-500"
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tariff.mileageBands.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">
                          No mileage bands configured.
                        </td>
                      </tr>
                    ) : (
                      tariff.mileageBands.map((band) => (
                        <tr key={band.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4 text-sm text-slate-700">
                            {band.minimumMiles}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-700">
                            {band.maximumMiles || "No limit"}
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                            {new Intl.NumberFormat("en-GB", {
                              style: "currency",
                              currency: "GBP",
                            }).format(Number(band.ratePerMile))}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex gap-1">
                              <button
                                onClick={() => openEdit(tariff.id, band)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                              >
                                <Pencil size={17} />
                              </button>
                              <button
                                onClick={() => void removeBand(band)}
                                disabled={workingId === band.id}
                                className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-50"
                              >
                                {workingId === band.id ? (
                                  <Loader2 size={17} className="animate-spin" />
                                ) : (
                                  <Trash2 size={17} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-xl font-bold text-slate-950">
                {editing ? "Edit mileage band" : "Add mileage band"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-2">
                <X size={21} />
              </button>
            </div>

            <form onSubmit={save} className="space-y-5 p-5">
              {!editing ? (
                <Field label="Tariff">
                  <select
                    value={form.tariffId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        tariffId: event.target.value,
                      }))
                    }
                    required
                    className={inputClass}
                  >
                    <option value="">Select tariff</option>
                    {tariffs.map((tariff) => (
                      <option key={tariff.id} value={tariff.id}>
                        {tariff.name} · {tariff.vehicleType}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Minimum miles">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minimumMiles}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        minimumMiles: event.target.value,
                      }))
                    }
                    required
                    className={inputClass}
                  />
                </Field>
                <Field label="Maximum miles">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.maximumMiles}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maximumMiles: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Rate per mile">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.ratePerMile}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ratePerMile: event.target.value,
                    }))
                  }
                  required
                  className={inputClass}
                />
              </Field>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 size={17} className="animate-spin" /> : null}
                  Save band
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  );
}