"use client";

import { Loader2, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:5000";

const DISCOUNT_TYPES = [
  "FIXED_AMOUNT",
  "PERCENTAGE",
  "CUSTOMER_LOYALTY",
  "MONTHLY",
] as const;

type DiscountType = (typeof DISCOUNT_TYPES)[number];

type Customer = {
  id: string;
  accountNumber: string | null;
  name: string;
  companyName: string | null;
  email: string;
};

type DiscountRule = {
  id: string;
  name: string;
  type: DiscountType;
  value: string;
  active: boolean;
  customerId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  notes: string | null;
  customer: Customer | null;
};

type FormState = {
  name: string;
  type: DiscountType;
  value: string;
  active: boolean;
  customerId: string;
  startsAt: string;
  endsAt: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  type: "PERCENTAGE",
  value: "",
  active: true,
  customerId: "",
  startsAt: "",
  endsAt: "",
  notes: "",
};

function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toDateInput(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export default function DiscountsPage() {
  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<DiscountRule | null>(null);
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

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (search) params.set("search", search);
      if (typeFilter) params.set("type", typeFilter);
      if (activeFilter) params.set("active", activeFilter);

      const response = await fetch(
        `${API_BASE_URL}/api/admin/discounts?${params.toString()}`,
        {
          headers: { "x-admin-key": getAdminKey() },
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load discount rules.");
      }

      setRules(data.rules);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load discount rules.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeFilter, getAdminKey, search, typeFilter]);

  const loadCustomers = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/discounts/customers`,
        {
          headers: { "x-admin-key": getAdminKey() },
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load customers.");
      }

      setCustomers(data.customers);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load customers.",
      );
    }
  }, [getAdminKey]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(rule: DiscountRule) {
    setEditing(rule);
    setForm({
      name: rule.name,
      type: rule.type,
      value: rule.value,
      active: rule.active,
      customerId: rule.customerId || "",
      startsAt: toDateInput(rule.startsAt),
      endsAt: toDateInput(rule.endsAt),
      notes: rule.notes || "",
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
          ? `${API_BASE_URL}/api/admin/discounts/${editing.id}`
          : `${API_BASE_URL}/api/admin/discounts`,
        {
          method: editing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey(),
          },
          body: JSON.stringify({
            ...form,
            value: Number(form.value),
            customerId: form.customerId || null,
            startsAt: form.startsAt || null,
            endsAt: form.endsAt || null,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save discount rule.");
      }

      setModalOpen(false);
      setSuccessMessage(editing ? "Discount rule updated." : "Discount rule created.");
      await loadRules();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save discount rule.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeRule(rule: DiscountRule) {
    if (!window.confirm(`Delete discount rule "${rule.name}"?`)) return;

    setWorkingId(rule.id);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/discounts/${rule.id}`,
        {
          method: "DELETE",
          headers: { "x-admin-key": getAdminKey() },
        },
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete discount rule.");
      }

      setSuccessMessage("Discount rule deleted.");
      await loadRules();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete discount rule.",
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
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Discounts</h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage fixed, percentage, loyalty and monthly discount rules.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-4 py-3 text-sm font-bold text-white"
        >
          <Plus size={18} />
          Add discount
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        These rules are stored in the database. They do not affect quote totals until the pricing engine explicitly applies them.
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
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 xl:flex-row">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchInput.trim());
            }}
            className="flex flex-1 gap-2"
          >
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search discount name or notes"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#FF6A00]"
              />
            </div>
            <button className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold">
              Search
            </button>
          </form>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
          >
            <option value="">All types</option>
            {DISCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {label(type)}
              </option>
            ))}
          </select>

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
            onClick={() => void loadRules()}
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
                {["Name", "Type", "Value", "Customer", "Dates", "Status", "Actions"].map(
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
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Loader2 className="mx-auto animate-spin text-[#FF6A00]" />
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-slate-500">
                    No discount rules found.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 text-sm font-bold text-slate-950">{rule.name}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{label(rule.type)}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {rule.type === "FIXED_AMOUNT"
                        ? new Intl.NumberFormat("en-GB", {
                            style: "currency",
                            currency: "GBP",
                          }).format(Number(rule.value))
                        : `${Number(rule.value)}%`}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {rule.customer
                        ? rule.customer.companyName || rule.customer.name
                        : "All customers"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {rule.startsAt ? new Date(rule.startsAt).toLocaleDateString("en-GB") : "Any"}{" "}
                      –{" "}
                      {rule.endsAt ? new Date(rule.endsAt).toLocaleDateString("en-GB") : "No end"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-bold",
                          rule.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600",
                        ].join(" ")}
                      >
                        {rule.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(rule)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          onClick={() => void removeRule(rule)}
                          disabled={workingId === rule.id}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          {workingId === rule.id ? (
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
                {editing ? "Edit discount rule" : "Add discount rule"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-2">
                <X size={21} />
              </button>
            </div>

            <form onSubmit={save} className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    required
                    className={inputClass}
                  />
                </Field>
                <Field label="Type">
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        type: event.target.value as DiscountType,
                      }))
                    }
                    className={inputClass}
                  >
                    {DISCOUNT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {label(type)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Value">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.value}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        value: event.target.value,
                      }))
                    }
                    required
                    className={inputClass}
                  />
                </Field>
                <Field label="Customer">
                  <select
                    value={form.customerId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customerId: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">All customers</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.companyName || customer.name} · {customer.email}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Starts at">
                  <input
                    type="date"
                    value={form.startsAt}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        startsAt: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Ends at">
                  <input
                    type="date"
                    value={form.endsAt}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        endsAt: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </Field>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      active: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#FF6A00]"
                />
                <span className="text-sm font-bold text-slate-800">Active rule</span>
              </label>

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
                  Save discount
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
  label: fieldLabel,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {fieldLabel}
      </span>
      {children}
    </label>
  );
}