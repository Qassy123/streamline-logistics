"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

type AccountType = "PRIVATE" | "BUSINESS" | "TRADE";

type FormState = {
  accountType: AccountType;
  name: string;
  firstName: string;
  lastName: string;
  companyName: string;
  legalEntity: string;
  tradingName: string;
  email: string;
  accountsEmail: string;
  phone: string;
  alternativeContactNumber: string;
  mainContactName: string;
  jobTitle: string;
  companyRegistrationNumber: string;
  vatNumber: string;
  businessType: string;
  industry: string;
  companyWebsite: string;
  registeredAddressLine1: string;
  registeredAddressLine2: string;
  registeredTownCity: string;
  registeredCounty: string;
  registeredPostcode: string;
  registeredCountry: string;
  tradingAddressDifferent: boolean;
  tradingAddressLine1: string;
  tradingAddressLine2: string;
  tradingTownCity: string;
  tradingCounty: string;
  tradingPostcode: string;
  tradingCountry: string;
  estimatedShipmentsPerMonth: string;
  typicalShipmentType: string;
  internalNote: string;
  username: string;
  password: string;
  confirmPassword: string;
};

const initialState: FormState = {
  accountType: "BUSINESS",
  name: "",
  firstName: "",
  lastName: "",
  companyName: "",
  legalEntity: "",
  tradingName: "",
  email: "",
  accountsEmail: "",
  phone: "",
  alternativeContactNumber: "",
  mainContactName: "",
  jobTitle: "",
  companyRegistrationNumber: "",
  vatNumber: "",
  businessType: "",
  industry: "",
  companyWebsite: "",
  registeredAddressLine1: "",
  registeredAddressLine2: "",
  registeredTownCity: "",
  registeredCounty: "",
  registeredPostcode: "",
  registeredCountry: "United Kingdom",
  tradingAddressDifferent: false,
  tradingAddressLine1: "",
  tradingAddressLine2: "",
  tradingTownCity: "",
  tradingCounty: "",
  tradingPostcode: "",
  tradingCountry: "United Kingdom",
  estimatedShipmentsPerMonth: "",
  typicalShipmentType: "",
  internalNote: "",
  username: "",
  password: "",
  confirmPassword: "",
};

export default function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isPrivate = form.accountType === "PRIVATE";
  const isTrade = form.accountType === "TRADE";

  const resolvedCustomerName = useMemo(() => {
    if (form.name.trim()) return form.name.trim();

    const personalName = `${form.firstName} ${form.lastName}`.trim();

    if (personalName) return personalName;

    return form.companyName.trim();
  }, [form.companyName, form.firstName, form.lastName, form.name]);

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function copyRegisteredAddress() {
    setForm((current) => ({
      ...current,
      tradingAddressDifferent: false,
      tradingAddressLine1: "",
      tradingAddressLine2: "",
      tradingTownCity: "",
      tradingCounty: "",
      tradingPostcode: "",
      tradingCountry: "United Kingdom",
    }));
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const adminKey =
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";

    if (!adminKey) {
      setError(
        "Admin key is missing. Open Driver Management and unlock the admin area first.",
      );
      return;
    }

    if (!resolvedCustomerName) {
      setError("Customer name is required.");
      return;
    }

    const email = form.email.trim().toLowerCase();
    const accountsEmail = form.accountsEmail.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !form.phone.trim()) {
      setError("General email address and contact number are required.");
      return;
    }

    if (!emailPattern.test(email)) {
      setError("Enter a valid general email address.");
      return;
    }

    if (!isPrivate && !form.companyName.trim()) {
      setError("Business name is required for business and trade accounts.");
      return;
    }

    if (!isPrivate && !form.mainContactName.trim()) {
      setError("Main person to contact is required for business and trade accounts.");
      return;
    }

    if (!isPrivate && !accountsEmail) {
      setError("Accounts email address is required for business and trade accounts.");
      return;
    }

    if (accountsEmail && !emailPattern.test(accountsEmail)) {
      setError("Enter a valid accounts email address.");
      return;
    }

    if (
      !form.registeredAddressLine1.trim() ||
      !form.registeredTownCity.trim() ||
      !form.registeredPostcode.trim() ||
      !form.registeredCountry.trim()
    ) {
      setError("Complete the primary or registered office address.");
      return;
    }

    if (
      form.tradingAddressDifferent &&
      (
        !form.tradingAddressLine1.trim() ||
        !form.tradingTownCity.trim() ||
        !form.tradingPostcode.trim() ||
        !form.tradingCountry.trim()
      )
    ) {
      setError("Complete the separate trading address.");
      return;
    }

    if (form.password && form.password.length < 10) {
      setError("Temporary password must contain at least 10 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Temporary password and confirmation do not match.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE}/api/admin/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          accountType: form.accountType,
          name: resolvedCustomerName,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          companyName: isPrivate ? null : form.companyName.trim(),
          legalEntity: isPrivate
            ? null
            : form.legalEntity.trim() || form.companyName.trim(),
          tradingName: isPrivate ? null : form.tradingName.trim(),
          email: form.email.trim().toLowerCase(),
          accountsEmail: isPrivate
            ? null
            : form.accountsEmail.trim().toLowerCase(),
          phone: form.phone.trim(),
          alternativeContactNumber:
            form.alternativeContactNumber.trim() || null,
          mainContactName:
            form.mainContactName.trim() || resolvedCustomerName,
          jobTitle: form.jobTitle.trim() || null,
          companyRegistrationNumber: isPrivate
            ? null
            : form.companyRegistrationNumber.trim() || null,
          vatNumber: isPrivate ? null : form.vatNumber.trim() || null,
          businessType: isPrivate ? null : form.businessType.trim() || null,
          industry: isPrivate ? null : form.industry.trim() || null,
          companyWebsite: isPrivate
            ? null
            : form.companyWebsite.trim() || null,
          registeredAddressLine1: form.registeredAddressLine1.trim(),
          registeredAddressLine2:
            form.registeredAddressLine2.trim() || null,
          registeredTownCity: form.registeredTownCity.trim(),
          registeredCounty: form.registeredCounty.trim() || null,
          registeredPostcode: form.registeredPostcode.trim().toUpperCase(),
          registeredCountry: form.registeredCountry.trim(),
          tradingAddressDifferent:
            !isPrivate && form.tradingAddressDifferent,
          tradingAddressLine1:
            !isPrivate && form.tradingAddressDifferent
              ? form.tradingAddressLine1.trim()
              : null,
          tradingAddressLine2:
            !isPrivate && form.tradingAddressDifferent
              ? form.tradingAddressLine2.trim() || null
              : null,
          tradingTownCity:
            !isPrivate && form.tradingAddressDifferent
              ? form.tradingTownCity.trim()
              : null,
          tradingCounty:
            !isPrivate && form.tradingAddressDifferent
              ? form.tradingCounty.trim() || null
              : null,
          tradingPostcode:
            !isPrivate && form.tradingAddressDifferent
              ? form.tradingPostcode.trim().toUpperCase()
              : null,
          tradingCountry:
            !isPrivate && form.tradingAddressDifferent
              ? form.tradingCountry.trim()
              : null,
          estimatedShipmentsPerMonth: isPrivate
            ? null
            : form.estimatedShipmentsPerMonth.trim() || null,
          typicalShipmentType: isPrivate
            ? null
            : form.typicalShipmentType.trim() || null,
          internalNote: form.internalNote.trim() || null,
          username: form.username.trim().toLowerCase() || null,
          password: form.password || undefined,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          window.localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
        }

        throw new Error(payload?.error || "Unable to create customer account.");
      }

      const customerId = payload?.customer?.id as string | undefined;

      setSuccess("Customer account created successfully.");

      window.setTimeout(() => {
        if (customerId) {
          router.push(`/admin/customers/${customerId}`);
        } else {
          router.push("/admin/customers");
        }
      }, 700);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create customer account.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1450px]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Customer accounts
          </Link>

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Customer management
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Add new customer account
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Create a private customer, business customer or trade account for
            office-managed quotes, bookings and invoicing.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            Account preview
          </p>
          <p className="mt-1 font-bold text-slate-950">
            {resolvedCustomerName || "New customer"}
          </p>
          <p className="mt-1 text-sm text-slate-500">{form.accountType}</p>
        </div>
      </div>

      {error ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          <CircleAlert size={19} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      <form onSubmit={submitForm} className="mt-6 space-y-6">
        <Section
          title="Account type"
          description="Choose the customer account type required by the office."
          icon={ShieldCheck}
        >
          <div className="grid gap-3 md:grid-cols-3">
            {(["PRIVATE", "BUSINESS", "TRADE"] as AccountType[]).map(
              (type) => {
                const active = form.accountType === type;
                const Icon = type === "PRIVATE" ? UserRound : Building2;

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateField("accountType", type)}
                    className={[
                      "flex items-center gap-3 rounded-2xl border p-4 text-left transition",
                      active
                        ? "border-[#FF6A00] bg-orange-50 ring-2 ring-orange-100"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-11 w-11 items-center justify-center rounded-xl",
                        active
                          ? "bg-[#FF6A00] text-white"
                          : "bg-slate-100 text-slate-600",
                      ].join(" ")}
                    >
                      <Icon size={21} />
                    </span>
                    <span>
                      <span className="block font-bold text-slate-950">
                        {type === "PRIVATE"
                          ? "Private customer"
                          : type === "BUSINESS"
                            ? "Business account"
                            : "Trade account"}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {type === "PRIVATE"
                          ? "Individual customer"
                          : type === "BUSINESS"
                            ? "Business paying normally"
                            : "Business with credit terms"}
                      </span>
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </Section>

        <Section
          title="Customer identity"
          description="Core customer and contact information."
          icon={UserRound}
        >
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Field
              label="Customer display name"
              value={form.name}
              onChange={(value) => updateField("name", value)}
              placeholder="Customer or account name"
            />
            <Field
              label="First name"
              value={form.firstName}
              onChange={(value) => updateField("firstName", value)}
            />
            <Field
              label="Last name"
              value={form.lastName}
              onChange={(value) => updateField("lastName", value)}
            />
            {!isPrivate ? (
              <>
                <Field
                  label="Business name"
                  value={form.companyName}
                  onChange={(value) => updateField("companyName", value)}
                  required
                />
                <Field
                  label="Legal entity"
                  value={form.legalEntity}
                  onChange={(value) => updateField("legalEntity", value)}
                />
                <Field
                  label="Trading name"
                  value={form.tradingName}
                  onChange={(value) => updateField("tradingName", value)}
                />
              </>
            ) : null}
            <Field
              label="Main person to contact"
              value={form.mainContactName}
              onChange={(value) => updateField("mainContactName", value)}
              required
            />
            <Field
              label="Job title"
              value={form.jobTitle}
              onChange={(value) => updateField("jobTitle", value)}
            />
          </div>
        </Section>

        <Section
          title="Contact details"
          description="General and accounts contact information."
          icon={UserRound}
        >
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Field
              label="General email address"
              type="email"
              value={form.email}
              onChange={(value) => updateField("email", value)}
              required
            />
            <Field
              label="Accounts email address"
              type="email"
              value={form.accountsEmail}
              onChange={(value) => updateField("accountsEmail", value)}
            />
            <Field
              label="Contact number"
              value={form.phone}
              onChange={(value) => updateField("phone", value)}
              required
            />
            <Field
              label="Alternative contact number"
              value={form.alternativeContactNumber}
              onChange={(value) =>
                updateField("alternativeContactNumber", value)
              }
            />
            <Field
              label="Username"
              value={form.username}
              onChange={(value) => updateField("username", value)}
              hint="Optional customer portal username"
            />
            <Field
              label="Temporary password"
              type="password"
              value={form.password}
              onChange={(value) => updateField("password", value)}
              hint="Optional. Minimum 10 characters when supplied."
            />
            <Field
              label="Confirm temporary password"
              type="password"
              value={form.confirmPassword}
              onChange={(value) => updateField("confirmPassword", value)}
              hint="Must match the temporary password."
            />
          </div>
        </Section>

        {!isPrivate ? (
          <Section
            title="Business details"
            description="Company registration, VAT and trading details."
            icon={Building2}
          >
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <Field
                label="Companies House number"
                value={form.companyRegistrationNumber}
                onChange={(value) =>
                  updateField("companyRegistrationNumber", value)
                }
              />
              <Field
                label="VAT number"
                value={form.vatNumber}
                onChange={(value) => updateField("vatNumber", value)}
              />
              <Field
                label="Business type"
                value={form.businessType}
                onChange={(value) => updateField("businessType", value)}
              />
              <Field
                label="Industry"
                value={form.industry}
                onChange={(value) => updateField("industry", value)}
              />
              <Field
                label="Company website"
                value={form.companyWebsite}
                onChange={(value) => updateField("companyWebsite", value)}
                placeholder="example.co.uk"
              />
              <Field
                label="Estimated shipments per month"
                value={form.estimatedShipmentsPerMonth}
                onChange={(value) =>
                  updateField("estimatedShipmentsPerMonth", value)
                }
              />
              <Field
                label="Typical shipment type"
                value={form.typicalShipmentType}
                onChange={(value) =>
                  updateField("typicalShipmentType", value)
                }
              />
            </div>

            {isTrade ? (
              <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-800">
                A trade-account record will be created automatically with
                pending approval status. Credit limit and payment terms can be
                managed from Trade Accounts.
              </div>
            ) : null}
          </Section>
        ) : null}

        <Section
          title="Registered office address"
          description={
            isPrivate
              ? "Primary customer address."
              : "Registered office address for the business."
          }
          icon={Building2}
        >
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Field
              label="Address line 1"
              value={form.registeredAddressLine1}
              onChange={(value) =>
                updateField("registeredAddressLine1", value)
              }
              required
            />
            <Field
              label="Address line 2"
              value={form.registeredAddressLine2}
              onChange={(value) =>
                updateField("registeredAddressLine2", value)
              }
            />
            <Field
              label="Town / City"
              value={form.registeredTownCity}
              onChange={(value) =>
                updateField("registeredTownCity", value)
              }
              required
            />
            <Field
              label="County"
              value={form.registeredCounty}
              onChange={(value) => updateField("registeredCounty", value)}
            />
            <Field
              label="Postcode"
              value={form.registeredPostcode}
              onChange={(value) => updateField("registeredPostcode", value)}
              required
            />
            <Field
              label="Country"
              value={form.registeredCountry}
              onChange={(value) => updateField("registeredCountry", value)}
            />
          </div>
        </Section>

        {!isPrivate ? (
          <Section
            title="Trading address"
            description="Use a separate trading address when required."
            icon={Building2}
          >
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <input
                type="checkbox"
                checked={form.tradingAddressDifferent}
                onChange={(event) => {
                  if (event.target.checked) {
                    updateField("tradingAddressDifferent", true);
                  } else {
                    copyRegisteredAddress();
                  }
                }}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#FF6A00] focus:ring-orange-200"
              />
              <span>
                <span className="block font-bold text-slate-950">
                  Trading address is different
                </span>
                <span className="mt-1 block text-sm text-slate-500">
                  Tick this box to enter a separate trading address.
                </span>
              </span>
            </label>

            {form.tradingAddressDifferent ? (
              <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <Field
                  label="Address line 1"
                  value={form.tradingAddressLine1}
                  onChange={(value) =>
                    updateField("tradingAddressLine1", value)
                  }
                  required
                />
                <Field
                  label="Address line 2"
                  value={form.tradingAddressLine2}
                  onChange={(value) =>
                    updateField("tradingAddressLine2", value)
                  }
                />
                <Field
                  label="Town / City"
                  value={form.tradingTownCity}
                  onChange={(value) =>
                    updateField("tradingTownCity", value)
                  }
                  required
                />
                <Field
                  label="County"
                  value={form.tradingCounty}
                  onChange={(value) =>
                    updateField("tradingCounty", value)
                  }
                />
                <Field
                  label="Postcode"
                  value={form.tradingPostcode}
                  onChange={(value) =>
                    updateField("tradingPostcode", value)
                  }
                  required
                />
                <Field
                  label="Country"
                  value={form.tradingCountry}
                  onChange={(value) =>
                    updateField("tradingCountry", value)
                  }
                />
              </div>
            ) : null}
          </Section>
        ) : null}

        <Section
          title="Internal office notes"
          description="Optional information visible to office staff."
          icon={ShieldCheck}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Notes about the customer
            </span>
            <textarea
              value={form.internalNote}
              onChange={(event) =>
                updateField("internalNote", event.target.value)
              }
              rows={6}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
              placeholder="Account preferences, billing instructions, operational requirements or other office notes"
            />
          </label>
        </Section>

        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            This creates a permanent customer record linked to future quotes,
            bookings, invoices and payments.
          </p>

          <div className="flex gap-3">
            <Link
              href="/admin/customers"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E55300] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving customer
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save customer account
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
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
  icon: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4 border-b border-slate-200 pb-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          <Icon size={21} />
        </span>
        <div>
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
      />
      {hint ? (
        <span className="mt-1.5 block text-xs leading-5 text-slate-400">
          {hint}
        </span>
      ) : null}
    </label>
  );
} 
