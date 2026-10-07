"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";

type Line = { description: string; quantity: string; unitPrice: string; vatRate: string };
type Details = { recipientName: string; recipientEmail: string; recipientAddress: string; recipientPhone: string; invoiceDate: string };
type EditableInvoice = {
  id: string; userId?: string | null; dueDate?: string | null; supplyDate?: string | null;
  paymentTerms?: string | null; customerReference?: string | null; purchaseOrderNumber?: string | null; notes?: string | null;
  lines?: { sourceType?: string | null; description: string; quantity: string | number; unitPrice: string | number; vatRate?: string | number }[];
  auditEvents?: { eventType: string; metadata?: unknown }[];
};
type Customer = {
  id: string; name: string; companyName?: string | null; email: string; phone?: string | null; accountNumber?: string | null;
  registeredAddressLine1?: string | null; registeredAddressLine2?: string | null; registeredTownCity?: string | null;
  registeredCounty?: string | null; registeredPostcode?: string | null; registeredCountry?: string | null;
  billingProfile?: { paymentTermsDays: number; accountsEmail?: string | null } | null;
};

export function manualInvoiceDetails(invoice: { auditEvents?: { eventType: string; metadata?: unknown }[] }): Details | null {
  for (const event of [...(invoice.auditEvents || [])].reverse()) {
    if (!["MANUAL_INVOICE_CREATED", "MANUAL_INVOICE_UPDATED"].includes(event.eventType)) continue;
    const data = event.metadata as Partial<Details> | null;
    if (data && typeof data.recipientName === "string" && typeof data.recipientEmail === "string" && typeof data.recipientAddress === "string" && typeof data.invoiceDate === "string") {
      return { ...data, recipientPhone: data.recipientPhone || "" } as Details;
    }
  }
  return null;
}

function today() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
}
function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function money(value: number) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value); }
const fieldClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 focus:border-[#FF6A00] focus:outline-none";

export default function ManualInvoiceForm({ apiBase, adminKey, invoice, onClose, onSaved }: {
  apiBase: string; adminKey: string; invoice?: EditableInvoice | null;
  onClose: () => void; onSaved: (invoice: unknown, message: string) => void;
}) {
  const snapshot = invoice ? manualInvoiceDetails(invoice) : null;
  const initialDate = snapshot?.invoiceDate || today();
  const [form, setForm] = useState({
    userId: invoice?.userId || "", recipientName: snapshot?.recipientName || "", recipientEmail: snapshot?.recipientEmail || "",
    recipientAddress: snapshot?.recipientAddress || "", recipientPhone: snapshot?.recipientPhone || "",
    invoiceDate: initialDate, supplyDate: invoice?.supplyDate?.slice(0, 10) || initialDate,
    dueDate: invoice?.dueDate?.slice(0, 10) || addDays(initialDate, 30),
    paymentTerms: invoice?.paymentTerms || "30 days", customerReference: invoice?.customerReference || "",
    purchaseOrderNumber: invoice?.purchaseOrderNumber || "", notes: invoice?.notes || "",
  });
  const [lines, setLines] = useState<Line[]>(invoice?.lines?.filter((line) => line.sourceType === "MANUAL").map((line) => ({ description: line.description, quantity: String(line.quantity), unitPrice: String(line.unitPrice), vatRate: String(line.vatRate ?? 20) })) || [{ description: "", quantity: "1", unitPrice: "", vatRate: "20" }]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [defaultVat, setDefaultVat] = useState("20");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, "")}/api/invoices/admin/manual-options`, { headers: { "x-admin-key": adminKey }, cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load invoice options.");
        if (!controller.signal.aborted) {
          setCustomers(data.customers || []);
          setDefaultVat(String(data.vatRate ?? 20));
          if (!invoice) {
            const days = Number(data.paymentTermsDays ?? 30);
            setForm((current) => ({ ...current, paymentTerms: `${days} days`, dueDate: addDays(current.invoiceDate, days) }));
            setLines((current) => current.map((line) => ({ ...line, vatRate: String(data.vatRate ?? 20) })));
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load invoice options.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [apiBase, adminKey, invoice]);

  function update(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function selectCustomer(userId: string) {
    const customer = customers.find((item) => item.id === userId);
    if (!customer) { setForm((current) => ({ ...current, userId: "", recipientName: "", recipientEmail: "", recipientAddress: "", recipientPhone: "" })); return; }
    const days = customer.billingProfile?.paymentTermsDays ?? 30;
    setForm((current) => ({ ...current, userId, recipientName: customer.companyName || customer.name,
      recipientEmail: customer.billingProfile?.accountsEmail || customer.email, recipientPhone: customer.phone || "",
      recipientAddress: [customer.registeredAddressLine1, customer.registeredAddressLine2, customer.registeredTownCity, customer.registeredCounty, customer.registeredPostcode, customer.registeredCountry].filter(Boolean).join(", "),
      paymentTerms: `${days} days`, dueDate: addDays(current.invoiceDate, days),
    }));
  }
  function updateLine(index: number, field: keyof Line, value: string) { setLines((current) => current.map((line, i) => i === index ? { ...line, [field]: value } : line)); }
  const preview = lines.reduce((totals, line) => {
    const net = Math.round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0) * 100) / 100;
    const vat = Math.round(net * (Number(line.vatRate) || 0)) / 100;
    return { net: totals.net + net, vat: totals.vat + vat };
  }, { net: 0, vat: 0 });

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`${apiBase.replace(/\/$/, "")}/api/invoices/admin/${invoice ? `${invoice.id}/manual` : "manual"}`, {
        method: invoice ? "PATCH" : "POST", headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, lines, requestId }),
      });
      const data = await response.json();
      if (!response.ok || !data.invoice) throw new Error(data.error || "Unable to save manual invoice.");
      onSaved(data.invoice, data.message || "Manual invoice saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save manual invoice."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="manual-invoice-title" className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 sm:p-6">
          <div><h2 id="manual-invoice-title" className="text-2xl font-bold text-slate-950">{invoice ? "Edit Manual Invoice" : "Manual Invoice"}</h2><p className="mt-2 text-sm text-slate-600">Create an invoice from scratch. No booking is required.</p></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close manual invoice" className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:opacity-50"><X size={20} /></button>
        </div>
        <form onSubmit={(event) => void save(event)} className="space-y-6 p-5 sm:p-6">
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
          {loading && <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 size={18} className="animate-spin" />Loading customer accounts…</p>}
          <fieldset disabled={saving || loading} className="space-y-6 disabled:opacity-70">
            <label className="block text-sm font-bold text-slate-700">Customer account<select value={form.userId} onChange={(event) => selectCustomer(event.target.value)} className={fieldClass}><option value="">New / guest recipient — no account</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.companyName || customer.name}{customer.accountNumber ? ` · ${customer.accountNumber}` : ""} · {customer.email}</option>)}</select></label>
            <p className="text-sm text-slate-600">The billing details below belong to this invoice. Editing them does not change a customer account.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">Recipient / company name<input required maxLength={150} value={form.recipientName} onChange={(e) => update("recipientName", e.target.value)} className={fieldClass} /></label>
              <label className="text-sm font-bold text-slate-700">Email to send invoice<input required type="email" maxLength={254} value={form.recipientEmail} onChange={(e) => update("recipientEmail", e.target.value)} className={fieldClass} /></label>
              <label className="text-sm font-bold text-slate-700 sm:col-span-2">Billing address<textarea required maxLength={500} rows={3} value={form.recipientAddress} onChange={(e) => update("recipientAddress", e.target.value)} className={fieldClass} /></label>
              <label className="text-sm font-bold text-slate-700">Phone<input maxLength={50} value={form.recipientPhone} onChange={(e) => update("recipientPhone", e.target.value)} className={fieldClass} /></label>
              <label className="text-sm font-bold text-slate-700">Invoice date<input required type="date" value={form.invoiceDate} onChange={(e) => update("invoiceDate", e.target.value)} className={fieldClass} /></label>
              <label className="text-sm font-bold text-slate-700">Supply / service date<input required type="date" value={form.supplyDate} onChange={(e) => update("supplyDate", e.target.value)} className={fieldClass} /></label>
              <label className="text-sm font-bold text-slate-700">Due date<input required type="date" min={form.invoiceDate} value={form.dueDate} onChange={(e) => update("dueDate", e.target.value)} className={fieldClass} /></label>
              <label className="text-sm font-bold text-slate-700">Payment terms<input required maxLength={150} value={form.paymentTerms} onChange={(e) => update("paymentTerms", e.target.value)} className={fieldClass} /></label>
              <label className="text-sm font-bold text-slate-700">Customer reference<input maxLength={100} value={form.customerReference} onChange={(e) => update("customerReference", e.target.value)} className={fieldClass} /></label>
              <label className="text-sm font-bold text-slate-700">Purchase order / order reference<input maxLength={100} value={form.purchaseOrderNumber} onChange={(e) => update("purchaseOrderNumber", e.target.value)} className={fieldClass} /></label>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-950">Invoice lines</h3>
              {lines.map((line, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between"><span className="text-sm font-bold text-slate-700">Line {index + 1}</span><button type="button" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} disabled={lines.length === 1} aria-label={`Remove line ${index + 1}`} className="rounded-lg p-2 text-red-700 disabled:opacity-30"><Trash2 size={17} /></button></div>
                  <label className="block text-sm font-bold text-slate-700">Description<textarea required maxLength={500} rows={2} value={line.description} onChange={(e) => updateLine(index, "description", e.target.value)} className={fieldClass} /></label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="text-sm font-bold text-slate-700">Quantity<input required type="number" min="0.001" max="100000" step="0.001" value={line.quantity} onChange={(e) => updateLine(index, "quantity", e.target.value)} className={fieldClass} /></label>
                    <label className="text-sm font-bold text-slate-700">Unit price (£, before VAT)<input required type="number" min="0" max="1000000" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(index, "unitPrice", e.target.value)} className={fieldClass} /></label>
                    <label className="text-sm font-bold text-slate-700">VAT rate (%)<input required type="number" min="0" max="100" step="0.01" value={line.vatRate} onChange={(e) => updateLine(index, "vatRate", e.target.value)} className={fieldClass} /></label>
                  </div>
                </div>
              ))}
              <button type="button" disabled={lines.length >= 50} onClick={() => setLines((current) => [...current, { description: "", quantity: "1", unitPrice: "", vatRate: defaultVat }])} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50"><Plus size={17} />Add line</button>
            </div>
            <label className="block text-sm font-bold text-slate-700">Invoice notes<textarea rows={3} maxLength={2000} value={form.notes} onChange={(e) => update("notes", e.target.value)} className={fieldClass} /></label>
          </fieldset>
          <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3"><div><p className="text-sm text-slate-600">Subtotal</p><p className="text-lg font-bold">{money(preview.net)}</p></div><div><p className="text-sm text-slate-600">VAT</p><p className="text-lg font-bold">{money(preview.vat)}</p></div><div><p className="text-sm text-slate-600">Total</p><p className="text-lg font-bold">{money(preview.net + preview.vat)}</p></div></div>
          <p className="text-sm text-slate-600">The invoice number is assigned when saved. The invoice starts as a draft so you can review it before sending.</p>
          <div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button><button type="submit" disabled={saving || loading} className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white hover:bg-[#E55300] disabled:opacity-50">{saving && <Loader2 size={17} className="animate-spin" />}{saving ? "Saving…" : invoice ? "Save Changes" : "Create Manual Invoice"}</button></div>
        </form>
      </section>
    </div>
  );
}
