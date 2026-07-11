"use client";

import {
  Building2,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:5000";

type CompanySettings = {
  id: string;
  companyName: string;
  companyAddress: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
  companyRegistrationNumber: string | null;
  vatNumber: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  sortCode: string | null;
  accountNumber: string | null;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  paymentTermsDays: number;
  vatRate: string;
  currency: string;
  footerMessage: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type EnvironmentStatus = {
  cloudinaryConfigured: boolean;
  stripeConfigured: boolean;
  resendConfigured: boolean;
  adminKeyConfigured: boolean;
  databaseConfigured: boolean;
};

type SettingsResponse = {
  success: boolean;
  settings: CompanySettings;
  environment: EnvironmentStatus;
  message?: string;
};

type FormState = {
  companyName: string;
  companyAddress: string;
  telephone: string;
  email: string;
  website: string;
  companyRegistrationNumber: string;
  vatNumber: string;
  bankName: string;
  bankAccountName: string;
  sortCode: string;
  accountNumber: string;
  invoicePrefix: string;
  nextInvoiceNumber: string;
  paymentTermsDays: string;
  vatRate: string;
  currency: string;
  footerMessage: string;
  logoUrl: string;
  reason: string;
};

const emptyForm: FormState = {
  companyName: "",
  companyAddress: "",
  telephone: "",
  email: "",
  website: "",
  companyRegistrationNumber: "",
  vatNumber: "",
  bankName: "",
  bankAccountName: "",
  sortCode: "",
  accountNumber: "",
  invoicePrefix: "INV",
  nextInvoiceNumber: "1",
  paymentTermsDays: "30",
  vatRate: "20",
  currency: "GBP",
  footerMessage: "",
  logoUrl: "",
  reason: "",
};

function toForm(settings: CompanySettings): FormState {
  return {
    companyName: settings.companyName,
    companyAddress: settings.companyAddress || "",
    telephone: settings.telephone || "",
    email: settings.email || "",
    website: settings.website || "",
    companyRegistrationNumber: settings.companyRegistrationNumber || "",
    vatNumber: settings.vatNumber || "",
    bankName: settings.bankName || "",
    bankAccountName: settings.bankAccountName || "",
    sortCode: settings.sortCode || "",
    accountNumber: settings.accountNumber || "",
    invoicePrefix: settings.invoicePrefix,
    nextInvoiceNumber: String(settings.nextInvoiceNumber),
    paymentTermsDays: String(settings.paymentTermsDays),
    vatRate: String(settings.vatRate),
    currency: settings.currency,
    footerMessage: settings.footerMessage || "",
    logoUrl: settings.logoUrl || "",
    reason: "",
  };
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentStatus | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const getAdminKey = useCallback(() => {
    return window.localStorage.getItem("streamline_admin_key") || "";
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings`, {
        headers: {
          "x-admin-key": getAdminKey(),
        },
        cache: "no-store",
      });

      const data = (await response.json()) as SettingsResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load company settings.");
      }

      setSettings(data.settings);
      setEnvironment(data.environment);
      setForm(toForm(data.settings));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load company settings.",
      );
    } finally {
      setLoading(false);
    }
  }, [getAdminKey]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": getAdminKey(),
        },
        body: JSON.stringify({
          companyName: form.companyName,
          companyAddress: form.companyAddress,
          telephone: form.telephone,
          email: form.email,
          website: form.website,
          companyRegistrationNumber: form.companyRegistrationNumber,
          vatNumber: form.vatNumber,
          bankName: form.bankName,
          bankAccountName: form.bankAccountName,
          sortCode: form.sortCode,
          accountNumber: form.accountNumber,
          invoicePrefix: form.invoicePrefix,
          nextInvoiceNumber: Number(form.nextInvoiceNumber),
          paymentTermsDays: Number(form.paymentTermsDays),
          vatRate: Number(form.vatRate),
          currency: form.currency,
          footerMessage: form.footerMessage,
          logoUrl: form.logoUrl,
          reason: form.reason || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update company settings.");
      }

      setSettings(data.settings);
      setForm(toForm(data.settings));
      setSuccessMessage("Company settings updated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update company settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white py-24 text-center shadow-sm">
        <Loader2
          size={30}
          className="mx-auto animate-spin text-[#FF6A00]"
        />
        <p className="mt-3 text-sm font-medium text-slate-500">
          Loading company settings
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Administration
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Company Settings
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Manage company identity, invoice defaults, banking information,
            branding and integration status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadSettings()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw size={18} />
          Reload
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        This page exposes configuration status only. Secret API keys and
        environment values are never returned to the frontend.
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

      {environment ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Settings size={20} />
            </span>
            <div>
              <h2 className="font-bold text-slate-950">Integration status</h2>
              <p className="text-sm text-slate-500">
                Configuration presence only; secret values remain hidden.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Status label="Database" active={environment.databaseConfigured} />
            <Status label="Admin key" active={environment.adminKeyConfigured} />
            <Status
              label="Cloudinary"
              active={environment.cloudinaryConfigured}
            />
            <Status label="Stripe" active={environment.stripeConfigured} />
            <Status label="Resend" active={environment.resendConfigured} />
          </div>
        </section>
      ) : null}

      <form onSubmit={saveSettings} className="space-y-6">
        <Section
          title="Company identity"
          description="Public company and contact information."
          icon={Building2}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company name">
              <input
                value={form.companyName}
                onChange={(event) =>
                  updateField("companyName", event.target.value)
                }
                required
                className={inputClass}
              />
            </Field>

            <Field label="Telephone">
              <input
                value={form.telephone}
                onChange={(event) =>
                  updateField("telephone", event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Website">
              <input
                value={form.website}
                onChange={(event) =>
                  updateField("website", event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Company registration number">
              <input
                value={form.companyRegistrationNumber}
                onChange={(event) =>
                  updateField(
                    "companyRegistrationNumber",
                    event.target.value,
                  )
                }
                className={inputClass}
              />
            </Field>

            <Field label="VAT number">
              <input
                value={form.vatNumber}
                onChange={(event) =>
                  updateField("vatNumber", event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Company address">
                <textarea
                  value={form.companyAddress}
                  onChange={(event) =>
                    updateField("companyAddress", event.target.value)
                  }
                  rows={4}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Logo URL">
                <input
                  value={form.logoUrl}
                  onChange={(event) =>
                    updateField("logoUrl", event.target.value)
                  }
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section
          title="Invoice defaults"
          description="Default numbering, payment terms, VAT and currency."
          icon={FileText}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Field label="Invoice prefix">
              <input
                value={form.invoicePrefix}
                onChange={(event) =>
                  updateField("invoicePrefix", event.target.value)
                }
                required
                className={inputClass}
              />
            </Field>

            <Field label="Next invoice number">
              <input
                type="number"
                min="0"
                step="1"
                value={form.nextInvoiceNumber}
                onChange={(event) =>
                  updateField("nextInvoiceNumber", event.target.value)
                }
                required
                className={inputClass}
              />
            </Field>

            <Field label="Payment terms (days)">
              <input
                type="number"
                min="0"
                step="1"
                value={form.paymentTermsDays}
                onChange={(event) =>
                  updateField("paymentTermsDays", event.target.value)
                }
                required
                className={inputClass}
              />
            </Field>

            <Field label="VAT rate (%)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.vatRate}
                onChange={(event) =>
                  updateField("vatRate", event.target.value)
                }
                required
                className={inputClass}
              />
            </Field>

            <Field label="Currency">
              <input
                maxLength={3}
                value={form.currency}
                onChange={(event) =>
                  updateField("currency", event.target.value.toUpperCase())
                }
                required
                className={inputClass}
              />
            </Field>

            <div className="md:col-span-2 xl:col-span-5">
              <Field label="Invoice footer message">
                <textarea
                  value={form.footerMessage}
                  onChange={(event) =>
                    updateField("footerMessage", event.target.value)
                  }
                  rows={4}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section
          title="Bank details"
          description="Payment details shown on invoices and account documents."
          icon={CreditCard}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Bank name">
              <input
                value={form.bankName}
                onChange={(event) =>
                  updateField("bankName", event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Account name">
              <input
                value={form.bankAccountName}
                onChange={(event) =>
                  updateField("bankAccountName", event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Sort code">
              <input
                value={form.sortCode}
                onChange={(event) =>
                  updateField("sortCode", event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Account number">
              <input
                value={form.accountNumber}
                onChange={(event) =>
                  updateField("accountNumber", event.target.value)
                }
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Change record"
          description="Optional reason stored in the audit log."
          icon={Settings}
        >
          <Field label="Reason for change">
            <textarea
              value={form.reason}
              onChange={(event) =>
                updateField("reason", event.target.value)
              }
              rows={3}
              className={inputClass}
            />
          </Field>
        </Section>

        <div className="sticky bottom-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#E85F00] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Save settings
          </button>
        </div>
      </form>

      {settings ? (
        <p className="text-xs text-slate-500">
          Last updated{" "}
          {new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(settings.updatedAt))}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100";

function Status({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-xl border p-4",
        active
          ? "border-emerald-200 bg-emerald-50"
          : "border-amber-200 bg-amber-50",
      ].join(" ")}
    >
      {active ? (
        <CheckCircle2 size={19} className="text-emerald-700" />
      ) : (
        <CircleAlert size={19} className="text-amber-700" />
      )}
      <div>
        <p className="text-sm font-bold text-slate-800">{label}</p>
        <p
          className={[
            "text-xs font-semibold",
            active ? "text-emerald-700" : "text-amber-700",
          ].join(" ")}
        >
          {active ? "Configured" : "Not configured"}
        </p>
      </div>
    </div>
  );
}

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

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon size={20} />
        </span>
        <div>
          <h2 className="font-bold text-slate-950">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}