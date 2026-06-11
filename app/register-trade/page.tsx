"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Banknote,
  Building2,
  CheckCircle,
  CreditCard,
  FileText,
  Lock,
  MapPin,
  ShieldCheck,
  Truck,
  User,
} from "lucide-react";

const API_URL =
  "https://streamline-logistics-production.up.railway.app/api/trade-accounts/apply";

const businessTypes = [
  "Sole Trader",
  "Limited Company",
  "LLP",
  "Partnership",
  "Charity",
  "Public Sector",
  "Other",
];

const annualTurnovers = [
  "Under £100,000",
  "£100,000 - £500,000",
  "£500,000 - £1 Million",
  "£1 Million - £5 Million",
  "£5 Million+",
];

const creditLimits = [
  { label: "£500", value: "500" },
  { label: "£1,000", value: "1000" },
  { label: "£2,500", value: "2500" },
  { label: "£5,000", value: "5000" },
  { label: "£10,000+", value: "10000" },
];

const monthlySpendOptions = [
  "Under £500",
  "£500 - £2,000",
  "£2,000 - £5,000",
  "£5,000 - £10,000",
  "£10,000+",
];

const shipmentVolumes = ["1-25", "26-100", "101-500", "500+"];

const paymentTerms = [
  { label: "7 Days", value: "7" },
  { label: "14 Days", value: "14" },
  { label: "30 Days", value: "30" },
];

function getResponseErrorMessage(data: unknown) {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error?: unknown }).error === "string"
  ) {
    return (data as { error: string }).error;
  }

  return "Unable to submit trade account application. Please try again.";
}

export default function RegisterTradePage() {
  return (
    <Suspense fallback={<RegisterTradeLoading />}>
      <RegisterTradeForm />
    </Suspense>
  );
}

function RegisterTradeLoading() {
  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-10 text-[#071D49] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-[#D7E6FF] bg-white p-8 shadow-2xl shadow-black/10">
          <p className="text-sm font-bold text-[#006CFF]">
            Loading trade account application...
          </p>
        </section>
      </div>
    </main>
  );
}

function RegisterTradeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("quoteId") || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tradingAddressDifferent, setTradingAddressDifferent] = useState(false);

  const [serviceNextDayDelivery, setServiceNextDayDelivery] = useState(false);
  const [serviceMultiDrop, setServiceMultiDrop] = useState(false);
  const [serviceDedicatedVehicles, setServiceDedicatedVehicles] = useState(false);

  const [authorisedToApply, setAuthorisedToApply] = useState(false);
  const [creditCheckConsent, setCreditCheckConsent] = useState(false);
  const [creditSubjectToApproval, setCreditSubjectToApproval] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

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

    if (
      !authorisedToApply ||
      !creditCheckConsent ||
      !creditSubjectToApproval ||
      !termsAccepted ||
      !privacyAccepted
    ) {
      setError("Please complete all required declarations.");
      setLoading(false);
      return;
    }

    if (
      !serviceNextDayDelivery &&
      !serviceMultiDrop &&
      !serviceDedicatedVehicles
    ) {
      setError("Please select at least one service requirement.");
      setLoading(false);
      return;
    }

    const payload = {
      quoteId,

      legalEntity: formData.get("legalEntity"),
      tradingName: formData.get("tradingName"),
      companyRegistrationNumber: formData.get("companyRegistrationNumber"),
      vatNumber: formData.get("vatNumber"),
      dateBusinessEstablished: formData.get("dateBusinessEstablished"),
      businessType: formData.get("businessType"),
      companyWebsite: formData.get("companyWebsite"),
      annualTurnover: formData.get("annualTurnover"),

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

      accountsContactName: formData.get("accountsContactName"),
      accountsJobTitle: formData.get("accountsJobTitle"),
      accountsEmail: formData.get("accountsEmail"),
      accountsPhone: formData.get("accountsPhone"),
      invoiceDeliveryEmail: formData.get("invoiceDeliveryEmail"),

      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      jobTitle: formData.get("jobTitle"),
      email: formData.get("email"),
      mobileNumber: formData.get("mobileNumber"),

      requestedCreditLimit: formData.get("requestedCreditLimit"),
      expectedMonthlySpend: formData.get("expectedMonthlySpend"),
      estimatedShipmentsPerMonth: formData.get("estimatedShipmentsPerMonth"),
      preferredPaymentTerms: formData.get("preferredPaymentTerms"),

      serviceNextDayDelivery,
      serviceMultiDrop,
      serviceDedicatedVehicles,

      password,
      confirmPassword,

      authorisedToApply,
      creditCheckConsent,
      creditSubjectToApproval,
      termsAccepted,
      privacyAccepted,
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

      router.push(
        quoteId
          ? `/payments?quoteId=${quoteId}&tradeAccountApplication=received`
          : data?.redirectUrl || "/payment-success?tradeAccountApplication=received"
      );
    } catch (error) {
      console.error("Trade account application error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Unable to submit trade account application. Please try again."
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
              Monthly business credit account
            </p>

            <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_0.75fr] lg:items-end">
              <div>
                <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
                  Apply for a monthly invoicing business credit account.
                </h1>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
                  We deliver now. You pay later. Access monthly invoicing,
                  dedicated account management, preferential rates and agreed
                  credit terms for your business.
                </p>
              </div>

              <div className="rounded-3xl border border-[#2D8CFF]/30 bg-white/[0.08] p-5">
                <p className="text-sm font-bold text-white">What happens next</p>

                <div className="mt-4 grid gap-3 text-sm text-white/75">
                  {[
                    "Application submitted",
                    "Company verification and credit assessment",
                    "Credit limit and payment terms reviewed",
                    "Approval typically within 48 hours",
                    "Once approved, bookings can be invoiced monthly",
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

          <form onSubmit={handleSubmit} className="grid gap-8 p-5 sm:p-8">
            {quoteId && (
              <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 text-sm font-semibold text-[#071D49]">
                Quote reference retained: {quoteId}
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
                {error}
              </div>
            )}

            <FormSection
              icon={Building2}
              step="Step 1"
              title="Company information"
              text="Enter the registered business details for the credit application."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField name="legalEntity" label="Registered Business Name" required />
                <TextField name="tradingName" label="Trading Name If Different" />
                <TextField
                  name="companyRegistrationNumber"
                  label="Company Registration Number"
                  required
                />
                <TextField name="vatNumber" label="VAT Number" />
                <TextField
                  name="dateBusinessEstablished"
                  label="Date Business Established"
                  type="date"
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

                <TextField
                  name="companyWebsite"
                  label="Company Website"
                  type="url"
                  placeholder="https://"
                />

                <SelectField name="annualTurnover" label="Annual Turnover" required>
                  <option value="">Select annual turnover</option>
                  {annualTurnovers.map((turnover) => (
                    <option key={turnover} value={turnover}>
                      {turnover}
                    </option>
                  ))}
                </SelectField>
              </div>
            </FormSection>

            <FormSection
              icon={MapPin}
              step="Step 2"
              title="Registered business address"
              text="Enter the registered address and trading address if different."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField name="registeredAddressLine1" label="Address Line 1" required />
                <TextField name="registeredAddressLine2" label="Address Line 2" />
                <TextField name="registeredTownCity" label="Town / City" required />
                <TextField name="registeredCounty" label="County" />
                <TextField name="registeredPostcode" label="Postcode" required />
                <TextField
                  name="registeredCountry"
                  label="Country"
                  defaultValue="United Kingdom"
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
              icon={FileText}
              step="Step 3"
              title="Accounts payable contact"
              text="Enter the contact details for invoices and account correspondence."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField name="accountsContactName" label="Accounts Contact Name" required />
                <TextField name="accountsJobTitle" label="Job Title" />
                <TextField
                  name="accountsEmail"
                  label="Accounts Email Address"
                  type="email"
                  required
                />
                <TextField name="accountsPhone" label="Accounts Telephone Number" required />
                <TextField
                  name="invoiceDeliveryEmail"
                  label="Invoice Delivery Email"
                  type="email"
                  required
                />
              </div>
            </FormSection>

            <FormSection
              icon={User}
              step="Step 4"
              title="Primary account contact"
              text="Enter the person responsible for this trade account."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField name="firstName" label="First Name" required />
                <TextField name="lastName" label="Last Name" required />
                <TextField name="jobTitle" label="Position" required />
                <TextField
                  name="email"
                  label="Business Email"
                  type="email"
                  required
                />
                <TextField name="mobileNumber" label="Mobile Number" required />
              </div>
            </FormSection>

            <FormSection
              icon={CreditCard}
              step="Step 5"
              title="Credit application"
              text="Enter the requested credit facility and expected account usage."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  name="requestedCreditLimit"
                  label="Requested Credit Limit"
                  required
                >
                  <option value="">Select credit limit</option>
                  {creditLimits.map((limit) => (
                    <option key={limit.value} value={limit.value}>
                      {limit.label}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  name="expectedMonthlySpend"
                  label="Expected Monthly Spend"
                  required
                >
                  <option value="">Select monthly spend</option>
                  {monthlySpendOptions.map((spend) => (
                    <option key={spend} value={spend}>
                      {spend}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  name="estimatedShipmentsPerMonth"
                  label="Estimated Shipments Per Month"
                  required
                >
                  <option value="">Select shipment volume</option>
                  {shipmentVolumes.map((volume) => (
                    <option key={volume} value={volume}>
                      {volume}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  name="preferredPaymentTerms"
                  label="Preferred Payment Terms"
                  required
                >
                  <option value="">Select payment terms</option>
                  {paymentTerms.map((term) => (
                    <option key={term.value} value={term.value}>
                      {term.label}
                    </option>
                  ))}
                </SelectField>
              </div>
            </FormSection>

            <FormSection
              icon={Truck}
              step="Step 6"
              title="Service requirements"
              text="Select the services required for the trade account."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <CheckboxField
                  checked={serviceNextDayDelivery}
                  onChange={setServiceNextDayDelivery}
                  label="Next Day Delivery"
                />
                <CheckboxField
                  checked={serviceMultiDrop}
                  onChange={setServiceMultiDrop}
                  label="Multi Drop"
                />
                <CheckboxField
                  checked={serviceDedicatedVehicles}
                  onChange={setServiceDedicatedVehicles}
                  label="Dedicated Vehicles"
                />
              </div>
            </FormSection>

            <FormSection
              icon={Lock}
              step="Step 7"
              title="Security & access"
              text="Create a password for future access to the trade account."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  name="password"
                  label="Create Account Password"
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
              icon={ShieldCheck}
              step="Step 8"
              title="Declarations"
              text="Confirm authority and acceptance before submitting the application."
            >
              <div className="grid gap-4">
                <CheckboxField
                  checked={authorisedToApply}
                  onChange={setAuthorisedToApply}
                  label="I confirm that I am authorised to apply for credit on behalf of the business."
                />

                <CheckboxField
                  checked={creditCheckConsent}
                  onChange={setCreditCheckConsent}
                  label="I consent to credit checks being undertaken where necessary."
                />

                <CheckboxField
                  checked={creditSubjectToApproval}
                  onChange={setCreditSubjectToApproval}
                  label="I understand that credit facilities are subject to approval."
                />

                <CheckboxField
                  checked={termsAccepted}
                  onChange={setTermsAccepted}
                  label="I agree to the Terms and Conditions."
                />

                <CheckboxField
                  checked={privacyAccepted}
                  onChange={setPrivacyAccepted}
                  label="I agree to the Privacy Policy."
                />
              </div>
            </FormSection>

            <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 sm:p-6">
              <div className="mb-5 flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
                  <Banknote size={24} />
                </span>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#006CFF]">
                    Submit application
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-[#071D49]">
                    Apply for Monthly Credit Account
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Approval typically within 48 hours. You will return to secure
                    payment after submitting this application.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[linear-gradient(135deg,_#071D49_0%,_#0B2A63_50%,_#006CFF_100%)] px-8 py-5 text-base font-bold text-white shadow-xl shadow-[#071D49]/20 transition hover:to-[#2D8CFF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Submitting Trade Account Application..."
                  : "Apply For Monthly Credit Account"}
              </button>
            </div>
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