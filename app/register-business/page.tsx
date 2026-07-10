"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CheckCircle,
  FileText,
  Lock,
  MapPin,
  ShieldCheck,
  User,
} from "lucide-react";

const API_URL =
  "https://streamline-logistics-production.up.railway.app/api/accounts/business";
const QUOTE_API_URL =
  "https://streamline-logistics-production.up.railway.app/api/quotes";

const AUTH_TOKEN_STORAGE_KEY = "streamline_auth_token";
const AUTH_USER_STORAGE_KEY = "streamline_auth_user";

const businessTypes = [
  "Sole Trader",
  "Limited Company",
  "Partnership",
  "LLP",
  "Charity",
  "Public Sector",
  "Other",
];

const industries = [
  "Automotive",
  "Construction",
  "E-commerce",
  "Engineering",
  "Events",
  "Food & Beverage",
  "Healthcare",
  "Manufacturing",
  "Print & Packaging",
  "Professional Services",
  "Retail",
  "Wholesale",
  "Other",
];

type QuotePrefill = {
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  legalEntity?: string | null;
  companyName?: string | null;
  tradingName?: string | null;
  companyRegistrationNumber?: string | null;
  vatNumber?: string | null;
  companyWebsite?: string | null;
  accountsEmail?: string | null;
  registeredAddressLine1?: string | null;
  registeredAddressLine2?: string | null;
  registeredTownCity?: string | null;
  registeredCounty?: string | null;
  registeredPostcode?: string | null;
  registeredCountry?: string | null;
  collectionAddressDetails?: Partial<AddressFields> | null;
  collectionAddress?: string | null;
};

type AddressFields = {
  addressLine1: string;
  addressLine2: string;
  townCity: string;
  county: string;
  postcode: string;
};

type PrefillValues = {
  legalEntity: string;
  tradingName: string;
  companyRegistrationNumber: string;
  vatNumber: string;
  companyWebsite: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  alternativeContactNumber: string;
  accountsEmail: string;
  registeredAddressLine1: string;
  registeredAddressLine2: string;
  registeredTownCity: string;
  registeredCounty: string;
  registeredPostcode: string;
  registeredCountry: string;
};

const emptyPrefill: PrefillValues = {
  legalEntity: "",
  tradingName: "",
  companyRegistrationNumber: "",
  vatNumber: "",
  companyWebsite: "",
  firstName: "",
  lastName: "",
  email: "",
  mobileNumber: "",
  alternativeContactNumber: "",
  accountsEmail: "",
  registeredAddressLine1: "",
  registeredAddressLine2: "",
  registeredTownCity: "",
  registeredCounty: "",
  registeredPostcode: "",
  registeredCountry: "United Kingdom",
};

function getResponseErrorMessage(data: unknown) {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error?: unknown }).error === "string"
  ) {
    return (data as { error: string }).error;
  }

  return "Unable to create business account. Please try again.";
}

function splitCustomerName(name?: string | null) {
  if (!name) {
    return { firstName: "", lastName: "" };
  }

  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() || "";
  const lastName = parts.join(" ");

  return { firstName, lastName };
}

function normaliseAddressFields(
  details: Partial<AddressFields> | null | undefined,
  fallbackAddress?: string | null,
) {
  if (details && typeof details === "object") {
    return {
      addressLine1: details.addressLine1 || "",
      addressLine2: details.addressLine2 || "",
      townCity: details.townCity || "",
      county: details.county || "",
      postcode: details.postcode || "",
      country: "United Kingdom",
    };
  }

  if (!fallbackAddress) {
    return {
      addressLine1: "",
      addressLine2: "",
      townCity: "",
      county: "",
      postcode: "",
      country: "United Kingdom",
    };
  }

  const parts = fallbackAddress.split(",").map((part) => part.trim());

  return {
    addressLine1: parts[0] || "",
    addressLine2: parts[1] || "",
    townCity: parts[2] || "",
    county: parts[3] || "",
    postcode: parts[4] || "",
    country: "United Kingdom",
  };
}

function buildPrefillFromQuote(quote: QuotePrefill | null): PrefillValues {
  if (!quote) return emptyPrefill;

  const { firstName, lastName } = splitCustomerName(quote.customerName);
  const address = normaliseAddressFields(
    quote.collectionAddressDetails,
    quote.collectionAddress,
  );

  return {
    legalEntity: quote.legalEntity || quote.companyName || "",
    tradingName: quote.tradingName || "",
    companyRegistrationNumber: quote.companyRegistrationNumber || "",
    vatNumber: quote.vatNumber || "",
    companyWebsite: quote.companyWebsite || "",
    firstName,
    lastName,
    email: quote.customerEmail || "",
    mobileNumber: "",
    alternativeContactNumber: quote.customerPhone || "",
    accountsEmail: quote.accountsEmail || quote.customerEmail || "",
    registeredAddressLine1: quote.registeredAddressLine1 || address.addressLine1,
    registeredAddressLine2: quote.registeredAddressLine2 || address.addressLine2,
    registeredTownCity: quote.registeredTownCity || address.townCity,
    registeredCounty: quote.registeredCounty || address.county,
    registeredPostcode: quote.registeredPostcode || address.postcode,
    registeredCountry: quote.registeredCountry || address.country,
  };
}

export default function RegisterBusinessPage() {
  return (
    <Suspense fallback={<RegisterBusinessLoading />}>
      <RegisterBusinessForm />
    </Suspense>
  );
}

function RegisterBusinessLoading() {
  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-10 text-[#071D49] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-[#D7E6FF] bg-white p-8 shadow-2xl shadow-black/10">
          <p className="text-sm font-bold text-[#006CFF]">
            Loading business account form...
          </p>
        </section>
      </div>
    </main>
  );
}

function RegisterBusinessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("quoteId") || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prefillLoaded, setPrefillLoaded] = useState(false);
  const [prefill, setPrefill] = useState<PrefillValues>(emptyPrefill);
  const [tradingAddressDifferent, setTradingAddressDifferent] = useState(false);
  const [authorisedToCreateAccount, setAuthorisedToCreateAccount] =
    useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  useEffect(() => {
    async function loadQuotePrefill() {
      if (!quoteId) {
        setPrefillLoaded(true);
        return;
      }

      try {
        const response = await fetch(`${QUOTE_API_URL}/${quoteId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          setPrefillLoaded(true);
          return;
        }

        const quote = (await response.json()) as QuotePrefill;
        setPrefill(buildPrefillFromQuote(quote));
      } catch {
        setPrefill(emptyPrefill);
      } finally {
        setPrefillLoaded(true);
      }
    }

    loadQuotePrefill();
  }, [quoteId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);

    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (!authorisedToCreateAccount || !acceptedTerms || !acceptedPrivacy) {
      setError("Please complete the required compliance confirmations.");
      setLoading(false);
      return;
    }

    const payload = {
      quoteId,

      legalEntity: formData.get("legalEntity"),
      tradingName: formData.get("tradingName"),
      companyRegistrationNumber: formData.get("companyRegistrationNumber"),
      vatNumber: formData.get("vatNumber"),
      businessType: formData.get("businessType"),
      industry: formData.get("industry"),
      companyWebsite: formData.get("companyWebsite"),

      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      jobTitle: formData.get("jobTitle"),
      email: formData.get("email"),
      mobileNumber: formData.get("mobileNumber"),
      alternativeContactNumber: formData.get("alternativeContactNumber"),
      accountsEmail: formData.get("accountsEmail"),

      registeredAddressLine1: formData.get("registeredAddressLine1"),
      registeredAddressLine2: formData.get("registeredAddressLine2"),
      registeredTownCity: formData.get("registeredTownCity"),
      registeredCounty: formData.get("registeredCounty"),
      registeredPostcode: formData.get("registeredPostcode"),
      registeredCountry: formData.get("registeredCountry"),

      tradingAddressDifferent,
      tradingAddressLine1: formData.get("tradingAddressLine1"),
      tradingAddressLine2: formData.get("tradingAddressLine2"),
      tradingTownCity: formData.get("tradingTownCity"),
      tradingCounty: formData.get("tradingCounty"),
      tradingPostcode: formData.get("tradingPostcode"),
      tradingCountry: formData.get("tradingCountry"),

      username: formData.get("username"),
      password,
      confirmPassword,

      howDidYouHear: formData.get("howDidYouHear"),

      authorisedToCreateAccount,
      acceptedTerms,
      acceptedPrivacy,
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(data));
      }

      if (data?.token) {
        window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, data.token);
      }

      if (data?.user) {
        window.localStorage.setItem(
          AUTH_USER_STORAGE_KEY,
          JSON.stringify(data.user)
        );
      }

      window.dispatchEvent(new Event("streamline-auth-change"));

      router.push(data?.redirectUrl || "/dashboard");
    } catch (error) {
      console.error("Business account registration error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create business account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-10 text-[#071D49] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-6 text-white sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
              Business account
            </p>

            <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_0.75fr] lg:items-end">
              <div>
                <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
                  Create your Streamline business account and access live delivery tracking.
                </h1>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
                  Create an account to manage business bookings, invoices, company details and live tracking for your deliveries.
                </p>
              </div>

              <div className="rounded-3xl border border-[#2D8CFF]/30 bg-white/[0.08] p-5">
                <p className="text-sm font-bold text-white">What happens next</p>

                <div className="mt-4 grid gap-3 text-sm text-white/75">
                  {[
                    "Account created instantly",
                    "Account confirmation shown after submission",
                    "Future bookings prepared for account features",
                    "Business account features",
                    "Live tracking for deliveries",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <CheckCircle size={17} className="text-[#2D8CFF]" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <form
            key={prefillLoaded ? "prefill-loaded" : "prefill-loading"}
            onSubmit={handleSubmit}
            className="grid gap-8 p-5 sm:p-8"
          >
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
                {error}
              </div>
            )}

            <FormSection
              icon={Building2}
              step="Step 1"
              title="Company information"
              text="Enter the legal business details for the account."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  name="legalEntity"
                  label="Legal Entity Name"
                  defaultValue={prefill.legalEntity}
                  required
                />
                <TextField
                  name="tradingName"
                  label="Trading Name If Different"
                  defaultValue={prefill.tradingName}
                />
                <TextField
                  name="companyRegistrationNumber"
                  label="Company Registration Number"
                  defaultValue={prefill.companyRegistrationNumber}
                  required
                />
                <TextField
                  name="vatNumber"
                  label="VAT Number"
                  defaultValue={prefill.vatNumber}
                  required
                />

                <SelectField name="businessType" label="Business Type" required>
                  <option value="">Select business type</option>
                  {businessTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </SelectField>

                <SelectField name="industry" label="Industry">
                  <option value="">Select industry</option>
                  {industries.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </SelectField>

                <TextField
                  name="companyWebsite"
                  label="Company Website"
                  type="text"
                  placeholder="example.co.uk"
                  defaultValue={prefill.companyWebsite}
                  required
                />
              </div>
            </FormSection>

            <FormSection
              icon={User}
              step="Step 2"
              title="Primary contact"
              text="Enter the person responsible for this business account."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  name="firstName"
                  label="First Name"
                  defaultValue={prefill.firstName}
                  required
                />
                <TextField
                  name="lastName"
                  label="Last Name"
                  defaultValue={prefill.lastName}
                  required
                />
                <TextField name="jobTitle" label="Job Title" />
                <TextField
                  name="email"
                  label="Email Address"
                  type="email"
                  defaultValue={prefill.email}
                  required
                />
                <TextField
                  name="mobileNumber"
                  label="Mobile Number (Optional)"
                  defaultValue={prefill.mobileNumber}
                />
                <TextField
                  name="alternativeContactNumber"
                  label="Contact Number"
                  defaultValue={prefill.alternativeContactNumber}
                  required
                />
                <TextField
                  name="accountsEmail"
                  label="Accounts Email Address"
                  type="email"
                  defaultValue={prefill.accountsEmail}
                  required
                />
              </div>
            </FormSection>

            <FormSection
              icon={MapPin}
              step="Step 3"
              title="Business address"
              text="Enter the registered business address and trading address if different."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  name="registeredAddressLine1"
                  label="Registered Address Line 1"
                  defaultValue={prefill.registeredAddressLine1}
                  required
                />
                <TextField
                  name="registeredAddressLine2"
                  label="Registered Address Line 2"
                  defaultValue={prefill.registeredAddressLine2}
                />
                <TextField
                  name="registeredTownCity"
                  label="Town / City"
                  defaultValue={prefill.registeredTownCity}
                  required
                />
                <TextField
                  name="registeredCounty"
                  label="County"
                  defaultValue={prefill.registeredCounty}
                />
                <TextField
                  name="registeredPostcode"
                  label="Postcode"
                  defaultValue={prefill.registeredPostcode}
                  required
                />
                <TextField
                  name="registeredCountry"
                  label="Country"
                  defaultValue={prefill.registeredCountry}
                  required
                />
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#D7E6FF] bg-white p-5 text-sm font-bold text-[#071D49]">
                <input
                  type="checkbox"
                  checked={tradingAddressDifferent}
                  onChange={(event) =>
                    setTradingAddressDifferent(event.target.checked)
                  }
                  className="mt-1"
                />
                Trading address is different from registered business address
              </label>

              {tradingAddressDifferent && (
                <div className="mt-5 grid gap-4 rounded-3xl border border-[#D7E6FF] bg-white p-5 md:grid-cols-2">
                  <TextField name="tradingAddressLine1" label="Trading Address Line 1" required />
                  <TextField name="tradingAddressLine2" label="Trading Address Line 2" />
                  <TextField name="tradingTownCity" label="Town / City" required />
                  <TextField name="tradingCounty" label="County" />
                  <TextField name="tradingPostcode" label="Postcode" required />
                  <TextField
                    name="tradingCountry"
                    label="Country"
                    defaultValue="United Kingdom"
                    required
                  />
                </div>
              )}
            </FormSection>

            <FormSection
              icon={Lock}
              step="Step 4"
              title="Account security"
              text="Create a username and password for future access to your business account."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  name="username"
                  label="Username"
                  required
                />
                <TextField
                  name="password"
                  label="Create Password"
                  type="password"
                  required
                />
                <TextField
                  name="confirmPassword"
                  label="Confirm Password"
                  type="password"
                  required
                />
              </div>
            </FormSection>

            <FormSection
              icon={FileText}
              step="Step 5"
              title="Marketing & preferences"
              text="Tell us how you found Streamline Logistics Group."
            >
              <SelectField name="howDidYouHear" label="How Did You Hear About Us?">
                <option value="">Select option</option>
                <option value="Google">Google</option>
                <option value="Social Media">Social Media</option>
                <option value="Referral">Referral</option>
                <option value="Existing Customer">Existing Customer</option>
                <option value="Vehicle Branding">Vehicle Branding</option>
                <option value="Other">Other</option>
              </SelectField>
            </FormSection>

            <FormSection
              icon={ShieldCheck}
              step="Step 6"
              title="Compliance"
              text="Confirm authority and acceptance before creating the account."
            >
              <div className="grid gap-4">
                <CheckboxField
                  checked={authorisedToCreateAccount}
                  onChange={setAuthorisedToCreateAccount}
                  label="I confirm I am authorised to create this business account"
                />

                <CheckboxField
                  checked={acceptedTerms}
                  onChange={setAcceptedTerms}
                  label="I agree to the Terms & Conditions"
                />

                <CheckboxField
                  checked={acceptedPrivacy}
                  onChange={setAcceptedPrivacy}
                  label="I agree to the Privacy Policy"
                />
              </div>
            </FormSection>

            <button
              type="submit"
              disabled={loading || !prefillLoaded}
              className="rounded-2xl bg-[linear-gradient(135deg,_#071D49_0%,_#0B2A63_50%,_#006CFF_100%)] px-8 py-5 text-base font-bold text-white shadow-xl shadow-[#071D49]/20 transition hover:to-[#2D8CFF] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Creating Business Account..."
                : "Create Business Account"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function FormSection({
  icon: Icon,
  step,
  title,
  text,
  children,
}: {
  icon: React.ElementType;
  step: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 sm:p-6">
      <div className="mb-6 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
          <Icon size={24} />
        </span>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#006CFF]">
            {step}
          </p>
          <h2 className="mt-2 text-xl font-bold text-[#071D49]">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

function TextField({
  name,
  label,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm font-semibold text-[#071D49]">
      {label}
      {required && <span className="text-[#006CFF]"> *</span>}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
      />
    </label>
  );
}

function SelectField({
  name,
  label,
  required = false,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-[#071D49]">
      {label}
      {required && <span className="text-[#006CFF]"> *</span>}
      <select
        name={name}
        required={required}
        className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
      >
        {children}
      </select>
    </label>
  );
}

function CheckboxField({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#D7E6FF] bg-white p-5 text-sm font-bold text-[#071D49]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1"
      />
      {label}
    </label>
  );
}
