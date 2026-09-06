"use client";

import {
  Building2,
  CreditCard,
  FileImage,
  FileText,
  Loader2,
  Save,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://streamline-logistics-production.up.railway.app";

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
  vehicleBlockHours: number;
  vatRate: string;
  currency: string;
  footerMessage: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type SettingsResponse = {
  success: boolean;
  settings: CompanySettings;
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
  };
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const logoInputRef = useRef<HTMLInputElement | null>(null);

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

  async function uploadLogo(file: File) {
    setUploadingLogo(true);
    setError("");
    setSuccessMessage("");

    try {
      const body = new FormData();
      body.append("logo", file);

      const response = await fetch(`${API_BASE_URL}/api/admin/settings/logo`, {
        method: "POST",
        headers: {
          "x-admin-key": getAdminKey(),
        },
        body,
      });

      const data = (await response.json()) as SettingsResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to upload company logo.");
      }

      setSettings(data.settings);
      setForm(toForm(data.settings));
      setSuccessMessage("Company logo uploaded.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload company logo.",
      );
    } finally {
      setUploadingLogo(false);

      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
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
        }),
      });

      const data = (await response.json()) as SettingsResponse;

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
        <Loader2 size={30} className="mx-auto animate-spin text-[#FF6A00]" />
        <p className="mt-3 text-sm font-medium text-slate-500">
          Loading company settings
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
          Tab 11
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
          Company Info / Settings
        </h1>
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

      <form onSubmit={saveSettings} className="space-y-6">
        <Section title="Business" icon={Building2}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company Name">
              <input
                value={form.companyName}
                onChange={(event) =>
                  updateField("companyName", event.target.value)
                }
                required
                className={inputClass}
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Address">
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

            <Field label="Tel">
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

            <Field label="Company Registration Number">
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

            <Field label="VAT Number">
              <input
                value={form.vatNumber}
                onChange={(event) =>
                  updateField("vatNumber", event.target.value)
                }
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="Bank" icon={CreditCard}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Bank Name">
              <input
                value={form.bankName}
                onChange={(event) =>
                  updateField("bankName", event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Account Name">
              <input
                value={form.bankAccountName}
                onChange={(event) =>
                  updateField("bankAccountName", event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Sort Code">
              <input
                value={form.sortCode}
                onChange={(event) =>
                  updateField("sortCode", event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Account Number">
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

        <Section title="Logo" icon={FileImage}>
          <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
            <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              {settings?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.logoUrl}
                  alt="Company logo"
                  className="max-h-28 max-w-full object-contain"
                />
              ) : (
                <div className="text-center text-sm text-slate-500">
                  <FileImage size={30} className="mx-auto mb-2" />
                  No logo uploaded
                </div>
              )}
            </div>

            <div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) {
                    void uploadLogo(file);
                  }
                }}
              />

              <button
                type="button"
                disabled={uploadingLogo}
                onClick={() => logoInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {uploadingLogo ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Upload size={18} />
                )}
                {settings?.logoUrl ? "Replace Logo" : "Upload Logo"}
              </button>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                JPG, PNG, WEBP or GIF. Maximum file size 5 MB.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Invoice" icon={FileText}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Invoice Prefix">
              <input
                value={form.invoicePrefix}
                onChange={(event) =>
                  updateField("invoicePrefix", event.target.value)
                }
                required
                className={inputClass}
              />
            </Field>

            <Field label="Starting Invoice Number">
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

            <Field label="Account Name">
              <input
                value={form.bankAccountName}
                onChange={(event) =>
                  updateField("bankAccountName", event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Payment Term">
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

            <Field label="VAT Rate">
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

            <div className="md:col-span-2">
              <Field label="Footer Message">
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

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || uploadingLogo}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#E85F00] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100";

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
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon size={20} />
        </span>
        <h2 className="font-bold text-slate-950">{title}</h2>
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}
