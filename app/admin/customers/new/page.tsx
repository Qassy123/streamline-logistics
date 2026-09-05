"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

type AccountType = "BUSINESS" | "TRADE";

type FormState = {
  accountName: string;

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

  email: string;
  accountsEmail: string;
  contactNumber1: string;
  contactNumber2: string;
  personToContact: string;
  companyRegistrationNumber: string;
  vatNumber: string;
  accountType: AccountType;
};

const initialForm: FormState = {
  accountName: "",

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

  email: "",
  accountsEmail: "",
  contactNumber1: "",
  contactNumber2: "",
  personToContact: "",
  companyRegistrationNumber: "",
  vatNumber: "",
  accountType: "BUSINESS",
};

function adminKey() {
  return window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";
}

export default function AddNewCustomerPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function update<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function validate() {
    if (!form.accountName.trim()) {
      return "Account Name is required.";
    }

    if (!form.registeredAddressLine1.trim()) {
      return "Registered Office Address is required.";
    }

    if (!form.registeredTownCity.trim()) {
      return "Registered Office town or city is required.";
    }

    if (!form.registeredPostcode.trim()) {
      return "Registered Office postcode is required.";
    }

    if (
      form.tradingAddressDifferent &&
      !form.tradingAddressLine1.trim()
    ) {
      return "Trading Address is required.";
    }

    if (
      form.tradingAddressDifferent &&
      !form.tradingTownCity.trim()
    ) {
      return "Trading Address town or city is required.";
    }

    if (
      form.tradingAddressDifferent &&
      !form.tradingPostcode.trim()
    ) {
      return "Trading Address postcode is required.";
    }

    if (!form.email.trim()) {
      return "Email (General) is required.";
    }

    if (!form.accountsEmail.trim()) {
      return "Accounts Email is required.";
    }

    if (!form.contactNumber1.trim()) {
      return "Contact Number 1 is required.";
    }

    if (!form.personToContact.trim()) {
      return "Person to Contact is required.";
    }

    return "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const key = adminKey();

      if (!key) {
        throw new Error("Admin key is required.");
      }

      const payload = {
        accountType: form.accountType,

        name: form.accountName.trim(),
        companyName: form.accountName.trim(),
        legalEntity: form.accountName.trim(),

        email: form.email.trim(),
        accountsEmail: form.accountsEmail.trim(),

        phone: form.contactNumber1.trim(),
        alternativeContactNumber:
          form.contactNumber2.trim() || null,

        mainContactName: form.personToContact.trim(),

        companyRegistrationNumber:
          form.companyRegistrationNumber.trim() || null,

        vatNumber: form.vatNumber.trim() || null,

        registeredAddressLine1:
          form.registeredAddressLine1.trim(),

        registeredAddressLine2:
          form.registeredAddressLine2.trim() || null,

        registeredTownCity:
          form.registeredTownCity.trim(),

        registeredCounty:
          form.registeredCounty.trim() || null,

        registeredPostcode:
          form.registeredPostcode.trim(),

        registeredCountry:
          form.registeredCountry.trim() || "United Kingdom",

        tradingAddressDifferent:
          form.tradingAddressDifferent,

        tradingAddressLine1:
          form.tradingAddressDifferent
            ? form.tradingAddressLine1.trim()
            : "",

        tradingAddressLine2:
          form.tradingAddressDifferent
            ? form.tradingAddressLine2.trim()
            : "",

        tradingTownCity:
          form.tradingAddressDifferent
            ? form.tradingTownCity.trim()
            : "",

        tradingCounty:
          form.tradingAddressDifferent
            ? form.tradingCounty.trim()
            : "",

        tradingPostcode:
          form.tradingAddressDifferent
            ? form.tradingPostcode.trim()
            : "",

        tradingCountry:
          form.tradingAddressDifferent
            ? form.tradingCountry.trim() || "United Kingdom"
            : "United Kingdom",
      };

      const response = await fetch(
        `${API_BASE}/api/admin/customers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": key,
          },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();

      if (!response.ok || !result?.customer) {
        throw new Error(
          result?.error || "Unable to create customer account.",
        );
      }

      setMessage("Customer account created successfully.");

      router.push(`/admin/customers/${result.customer.id}`);
      router.refresh();
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
    <div className="mx-auto w-full max-w-[1200px]">
      <div className="mb-7">
        <h1 className="text-3xl font-bold text-slate-950">
          Add New Customer Account
        </h1>
      </div>

      {message ? (
        <div className="mb-6 flex items-center gap-3 border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={19} />
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 flex items-center gap-3 border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          <CircleAlert size={19} />
          {error}
        </div>
      ) : null}

      <form
        onSubmit={submit}
        className="border border-slate-300 bg-white"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
          <ManualRow label="Account Name">
            <TextInput
              value={form.accountName}
              onChange={(value) => update("accountName", value)}
              required
            />
          </ManualRow>

          <ManualRow label="Registered Office Address">
            <AddressFields
              addressLine1={form.registeredAddressLine1}
              addressLine2={form.registeredAddressLine2}
              townCity={form.registeredTownCity}
              county={form.registeredCounty}
              postcode={form.registeredPostcode}
              country={form.registeredCountry}
              onAddressLine1={(value) =>
                update("registeredAddressLine1", value)
              }
              onAddressLine2={(value) =>
                update("registeredAddressLine2", value)
              }
              onTownCity={(value) =>
                update("registeredTownCity", value)
              }
              onCounty={(value) =>
                update("registeredCounty", value)
              }
              onPostcode={(value) =>
                update("registeredPostcode", value)
              }
              onCountry={(value) =>
                update("registeredCountry", value)
              }
            />
          </ManualRow>

          <ManualRow label="Trading Address if different">
            <div>
              <label className="mb-4 flex items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.tradingAddressDifferent}
                  onChange={(event) =>
                    update(
                      "tradingAddressDifferent",
                      event.target.checked,
                    )
                  }
                  className="h-4 w-4"
                />
                Trading address is different
              </label>

              {form.tradingAddressDifferent ? (
                <AddressFields
                  addressLine1={form.tradingAddressLine1}
                  addressLine2={form.tradingAddressLine2}
                  townCity={form.tradingTownCity}
                  county={form.tradingCounty}
                  postcode={form.tradingPostcode}
                  country={form.tradingCountry}
                  onAddressLine1={(value) =>
                    update("tradingAddressLine1", value)
                  }
                  onAddressLine2={(value) =>
                    update("tradingAddressLine2", value)
                  }
                  onTownCity={(value) =>
                    update("tradingTownCity", value)
                  }
                  onCounty={(value) =>
                    update("tradingCounty", value)
                  }
                  onPostcode={(value) =>
                    update("tradingPostcode", value)
                  }
                  onCountry={(value) =>
                    update("tradingCountry", value)
                  }
                />
              ) : (
                <p className="text-sm text-slate-500">
                  Same as Registered Office Address
                </p>
              )}
            </div>
          </ManualRow>

          <ManualRow label="Email (General)">
            <TextInput
              type="email"
              value={form.email}
              onChange={(value) => update("email", value)}
              required
            />
          </ManualRow>

          <ManualRow label="Accounts Email">
            <TextInput
              type="email"
              value={form.accountsEmail}
              onChange={(value) => update("accountsEmail", value)}
              required
            />
          </ManualRow>

          <ManualRow label="Contact Number 1">
            <TextInput
              type="tel"
              value={form.contactNumber1}
              onChange={(value) =>
                update("contactNumber1", value)
              }
              required
            />
          </ManualRow>

          <ManualRow label="Contact Number 2 (optional)">
            <TextInput
              type="tel"
              value={form.contactNumber2}
              onChange={(value) =>
                update("contactNumber2", value)
              }
            />
          </ManualRow>

          <ManualRow label="Person to Contact">
            <TextInput
              value={form.personToContact}
              onChange={(value) =>
                update("personToContact", value)
              }
              required
            />
          </ManualRow>

          <ManualRow label="Companies House Number (optional)">
            <TextInput
              value={form.companyRegistrationNumber}
              onChange={(value) =>
                update("companyRegistrationNumber", value)
              }
            />
          </ManualRow>

          <ManualRow label="VAT Number">
            <TextInput
              value={form.vatNumber}
              onChange={(value) =>
                update("vatNumber", value)
              }
            />
          </ManualRow>

          <ManualRow label="Account Type">
            <select
              value={form.accountType}
              onChange={(event) =>
                update(
                  "accountType",
                  event.target.value as AccountType,
                )
              }
              className="w-full max-w-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
            >
              <option value="BUSINESS">
                Business Account
              </option>
              <option value="TRADE">
                Trade Credit Account
              </option>
            </select>
          </ManualRow>
        </div>

        <div className="flex justify-end border-t border-slate-300 px-6 py-5">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-w-[190px] items-center justify-center gap-2 bg-[#FF6A00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#E85F00] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : null}

            Add Customer Account
          </button>
        </div>
      </form>
    </div>
  );
}

function ManualRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="border-b border-r border-slate-300 bg-slate-50 px-5 py-5 text-sm font-bold text-slate-800">
        {label}
      </div>

      <div className="border-b border-slate-300 px-5 py-5">
        {children}
      </div>
    </>
  );
}

function TextInput({
  value,
  onChange,
  type = "text",
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      className="w-full max-w-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
    />
  );
}

function AddressFields({
  addressLine1,
  addressLine2,
  townCity,
  county,
  postcode,
  country,
  onAddressLine1,
  onAddressLine2,
  onTownCity,
  onCounty,
  onPostcode,
  onCountry,
}: {
  addressLine1: string;
  addressLine2: string;
  townCity: string;
  county: string;
  postcode: string;
  country: string;
  onAddressLine1: (value: string) => void;
  onAddressLine2: (value: string) => void;
  onTownCity: (value: string) => void;
  onCounty: (value: string) => void;
  onPostcode: (value: string) => void;
  onCountry: (value: string) => void;
}) {
  return (
    <div className="grid max-w-3xl gap-3 md:grid-cols-2">
      <input
        value={addressLine1}
        onChange={(event) =>
          onAddressLine1(event.target.value)
        }
        placeholder="Address Line 1"
        className="border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500 md:col-span-2"
      />

      <input
        value={addressLine2}
        onChange={(event) =>
          onAddressLine2(event.target.value)
        }
        placeholder="Address Line 2"
        className="border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500 md:col-span-2"
      />

      <input
        value={townCity}
        onChange={(event) =>
          onTownCity(event.target.value)
        }
        placeholder="Town / City"
        className="border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
      />

      <input
        value={county}
        onChange={(event) =>
          onCounty(event.target.value)
        }
        placeholder="County"
        className="border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
      />

      <input
        value={postcode}
        onChange={(event) =>
          onPostcode(event.target.value)
        }
        placeholder="Postcode"
        className="border border-slate-300 px-3 py-3 text-sm uppercase outline-none focus:border-slate-500"
      />

      <input
        value={country}
        onChange={(event) =>
          onCountry(event.target.value)
        }
        placeholder="Country"
        className="border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
      />
    </div>
  );
}