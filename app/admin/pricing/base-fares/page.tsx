"use client";

import {
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:5000";

type Tariff = {
  id: string;
  name: string;
  vehicleType: string;
  baseFare: string;
  active: boolean;
  vatApplicable: boolean;
  createdAt: string;
  updatedAt: string;
  mileageBands: unknown[];
  charges: unknown[];
};

type FormState = {
  name: string;
  vehicleType: string;
  baseFare: string;
  active: boolean;
  vatApplicable: boolean;
};

const emptyForm: FormState = {
  name: "",
  vehicleType: "",
  baseFare: "",
  active: true,
  vatApplicable: true,
};

export default function BaseFaresPage() {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<Tariff | null>(null);
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
      const params = new URLSearchParams();

      if (search) params.set("search", search);
      if (activeFilter) params.set("active", activeFilter);

      const response = await fetch(
        `${API_BASE_URL}/api/admin/tariffs?${params.toString()}`,
        {
          headers: { "x-admin-key": getAdminKey() },
          cache: "no-store",
        },
      );

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
  }, [activeFilter, getAdminKey, search]);

  useEffect(() => {
    void loadTariffs();
  }, [loadTariffs]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(tariff: Tariff) {
    setEditing(tariff);
    setForm({
      name: tariff.name,
      vehicleType: tariff.vehicleType,
      baseFare: tariff.baseFare,
      active: tariff.active,
      vatApplicable: tariff.vatApplicable,
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
          ? `${API_BASE_URL}/api/admin/tariffs/${editing.id}`
          : `${API_BASE_URL}/api/admin/tariffs`,
        {
          method: editing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey(),
          },
          body: JSON.stringify({
            ...form,
            baseFare: Number(form.baseFare),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save tariff.");
      }

      setModalOpen(false);
      setSuccessMessage(editing ? "Base fare updated." : "Tariff created.");
      await loadTariffs();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save tariff.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeTariff(tariff: Tariff) {
    if (!window.confirm(`Delete tariff "${tariff.name}"?`)) return;

    setWorkingId(tariff.id);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/tariffs/${tariff.id}`,
        {
          method: "DELETE",
          headers: { "x-admin-key": getAdminKey() },
        },
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete tariff.");
      }

      setSuccessMessage("Tariff deleted.");
      await loadTariffs();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete tariff.",
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
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Base fares</h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage tariff names, vehicle types, minimum fares and VAT status.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-4 py-3 text-sm font-bold text-white"
        >
          <Plus size={18} />
          Add tariff
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

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchInput.trim());
            }}
            className="flex flex-1 gap-2"
          >
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search tariff or vehicle type"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#FF6A00]"
              />
            </div>
            <button className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold">
              Search
            </button>
          </form>

          <select
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>

          <button
            onClick={() => void loadTariffs()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold"
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Tariff",
                  "Vehicle type",
                  "Base fare",
                  "VAT",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-slate-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Loader2 className="mx-auto animate-spin text-[#FF6A00]" />
                  </td>
                </tr>
              ) : tariffs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-500">
                    No tariffs found.
                  </td>
                </tr>
              ) : (
                tariffs.map((tariff) => (
                  <tr key={tariff.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 text-sm font-bold text-slate-950">
                      {tariff.name}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {tariff.vehicleType}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {new Intl.NumberFormat("en-GB", {
                        style: "currency",
                        currency: "GBP",
                      }).format(Number(tariff.baseFare))}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {tariff.vatApplicable ? "Applicable" : "Exempt"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-bold",
                          tariff.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600",
                        ].join(" ")}
                      >
                        {tariff.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(tariff)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          onClick={() => void removeTariff(tariff)}
                          disabled={workingId === tariff.id}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          {workingId === tariff.id ? (
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

      {modalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-xl font-bold text-slate-950">
                {editing ? "Edit tariff" : "Add tariff"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-2">
                <X size={21} />
              </button>
            </div>

            <form onSubmit={save} className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tariff name">
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    required
                    className={inputClass}
                  />
                </Field>
                <Field label="Vehicle type">
                  <input
                    value={form.vehicleType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        vehicleType: event.target.value,
                      }))
                    }
                    required
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Base fare">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.baseFare}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      baseFare: event.target.value,
                    }))
                  }
                  required
                  className={inputClass}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Check
                  label="Active tariff"
                  checked={form.active}
                  onChange={(checked) =>
                    setForm((current) => ({ ...current, active: checked }))
                  }
                />
                <Check
                  label="VAT applicable"
                  checked={form.vatApplicable}
                  onChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      vatApplicable: checked,
                    }))
                  }
                />
              </div>

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
                  Save tariff
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

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#FF6A00]"
      />
      <span className="text-sm font-bold text-slate-800">{label}</span>
    </label>
  );
}