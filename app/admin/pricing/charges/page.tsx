"use client";

import { Loader2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://streamline-logistics-production.up.railway.app";

type Charge = {
  id: string;
  type: string;
  name: string;
  calculation: string;
  amount: string;
  active: boolean;
  vatApplicable: boolean;
};

type Tariff = {
  id: string;
  name: string;
  vehicleType: string;
  charges: Charge[];
};

type Options = {
  chargeTypes: string[];
  chargeCalculations: string[];
};

type FormState = {
  tariffId: string;
  type: string;
  name: string;
  calculation: string;
  amount: string;
  active: boolean;
  vatApplicable: boolean;
};

const emptyForm: FormState = {
  tariffId: "",
  type: "STOP",
  name: "",
  calculation: "FIXED",
  amount: "",
  active: true,
  vatApplicable: true,
};

function pretty(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function amountLabel(charge: Charge) {
  const amount = Number(charge.amount);

  if (charge.calculation === "PERCENTAGE") {
    return `${amount}%`;
  }

  const money = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);

  if (charge.calculation === "PER_STOP") return `${money} / stop`;
  if (charge.calculation === "PER_HOUR") return `${money} / hour`;
  if (charge.calculation === "PER_MILE") return `${money} / mile`;

  return money;
}

export default function ChargesPage() {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [options, setOptions] = useState<Options>({
    chargeTypes: [],
    chargeCalculations: [],
  });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<Charge | null>(null);
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
        throw new Error(data.message || "Unable to load charges.");
      }

      setTariffs(data.tariffs || []);
      setOptions({
        chargeTypes: data.options?.chargeTypes || [],
        chargeCalculations: data.options?.chargeCalculations || [],
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load charges.",
      );
    } finally {
      setLoading(false);
    }
  }, [getAdminKey]);

  useEffect(() => {
    void loadTariffs();
  }, [loadTariffs]);

  const allCharges = useMemo(
    () =>
      tariffs.flatMap((tariff) =>
        tariff.charges.map((charge) => ({
          tariff,
          charge,
        })),
      ),
    [tariffs],
  );

  function openCreate(tariffId?: string) {
    setEditing(null);
    setForm({
      ...emptyForm,
      tariffId: tariffId || tariffs[0]?.id || "",
      type: options.chargeTypes[0] || "STOP",
      calculation: options.chargeCalculations[0] || "FIXED",
    });
    setModalOpen(true);
  }

  function openEdit(tariffId: string, charge: Charge) {
    setEditing(charge);
    setForm({
      tariffId,
      type: charge.type,
      name: charge.name,
      calculation: charge.calculation,
      amount: charge.amount,
      active: charge.active,
      vatApplicable: charge.vatApplicable,
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
          ? `${API_BASE_URL}/api/admin/tariffs/charges/${editing.id}`
          : `${API_BASE_URL}/api/admin/tariffs/${form.tariffId}/charges`,
        {
          method: editing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey(),
          },
          body: JSON.stringify({
            type: form.type,
            name: form.name,
            calculation: form.calculation,
            amount: Number(form.amount),
            active: form.active,
            vatApplicable: form.vatApplicable,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save charge.");
      }

      setModalOpen(false);
      setSuccessMessage(editing ? "Charge updated." : "Charge added.");
      await loadTariffs();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save charge.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeCharge(charge: Charge) {
    if (!window.confirm(`Delete charge "${charge.name}"?`)) return;

    setWorkingId(charge.id);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/tariffs/charges/${charge.id}`,
        {
          method: "DELETE",
          headers: { "x-admin-key": getAdminKey() },
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete charge.");
      }

      setSuccessMessage("Charge deleted.");
      await loadTariffs();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete charge.",
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
            Tab 10 / Pricing
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Charges</h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage added stops, waiting charges, surcharges and other additional
            tariff charges.
          </p>
        </div>

        <button
          onClick={() => openCreate()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-4 py-3 text-sm font-bold text-white"
        >
          <Plus size={18} />
          Add Charge
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          "Added Stops",
          "Waiting Charge",
          "Night / Same Day",
          "Additional Charges",
        ].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-900 shadow-sm"
          >
            {item}
          </div>
        ))}
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

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Tariff",
                  "Charge",
                  "Type",
                  "Calculation",
                  "Amount",
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
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Loader2 className="mx-auto animate-spin text-[#FF6A00]" />
                  </td>
                </tr>
              ) : allCharges.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-16 text-center text-sm text-slate-500"
                  >
                    No charges configured.
                  </td>
                </tr>
              ) : (
                allCharges.map(({ tariff, charge }) => (
                  <tr key={charge.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-slate-950">
                        {tariff.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {tariff.vehicleType}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {charge.name}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {pretty(charge.type)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {pretty(charge.calculation)}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-900">
                      {amountLabel(charge)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {charge.vatApplicable ? "Applicable" : "Exempt"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-bold",
                          charge.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600",
                        ].join(" ")}
                      >
                        {charge.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(tariff.id, charge)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                          aria-label={`Edit ${charge.name}`}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          onClick={() => void removeCharge(charge)}
                          disabled={workingId === charge.id}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-50"
                          aria-label={`Delete ${charge.name}`}
                        >
                          {workingId === charge.id ? (
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
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <h2 className="text-xl font-bold text-slate-950">
                {editing ? "Edit Charge" : "Add Charge"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2"
                aria-label="Close"
              >
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
                <Field label="Charge Type">
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        type: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    {options.chargeTypes.map((type) => (
                      <option key={type} value={type}>
                        {pretty(type)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Calculation">
                  <select
                    value={form.calculation}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        calculation: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    {options.chargeCalculations.map((calculation) => (
                      <option key={calculation} value={calculation}>
                        {pretty(calculation)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Charge Name">
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  className={inputClass}
                />
              </Field>

              <Field label="Amount">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  required
                  className={inputClass}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Check
                  label="Active Charge"
                  checked={form.active}
                  onChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      active: checked,
                    }))
                  }
                />
                <Check
                  label="VAT Applicable"
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
                  {saving ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : null}
                  Save Charge
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
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
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
