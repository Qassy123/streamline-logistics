"use client";

import { useEffect, useState } from "react";
import { TRADE_PAYMENT_NOTICE, TRADE_PAYMENT_EXAMPLE } from "@/lib/billingPolicy";
import { Building2, Save, User } from "lucide-react";

const API_URL =
  "https://streamline-logistics-production.up.railway.app/api/accounts/me";

const AUTH_TOKEN_STORAGE_KEY = "streamline_auth_token";

type ProfileData = {
  legalEntity?: string;
  tradingName?: string;
  companyRegistrationNumber?: string;
  vatNumber?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
};

export default function ProfilePage() {
  const [accountType, setAccountType] = useState<string>("");
  const [accountsEmail, setAccountsEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState<ProfileData>({
    legalEntity: "",
    tradingName: "",
    companyRegistrationNumber: "",
    vatNumber: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    jobTitle: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) throw new Error("Unable to load profile");
      if (data.user) {
        setAccountType(data.user.accountType || "");
        setAccountsEmail(data.user.accountsEmail || data.user.email || "");
        setFormData({
          legalEntity: data.user.legalEntity || "",
          tradingName: data.user.tradingName || "",
          companyRegistrationNumber:
            data.user.companyRegistrationNumber || "",
          vatNumber: data.user.vatNumber || "",
          firstName: data.user.firstName || "",
          lastName: data.user.lastName || "",
          email: data.user.email || "",
          phone: data.user.phone || "",
          jobTitle: data.user.jobTitle || "",
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      const response = await fetch(API_URL, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save profile");
      }

      setMessage("Profile updated successfully.");
    } catch (error) {
      console.error(error);
      setMessage("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F4F8FF] p-6">
        Loading profile...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-xl">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-8 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
              Account Profile
            </p>

            <h1 className="mt-4 text-4xl font-bold">
              Company Details
            </h1>
          </div>

          <form
            onSubmit={handleSave}
            className="grid gap-8 p-6 md:grid-cols-2"
          >
            <Input
              icon={<Building2 size={18} />}
              label="Legal Entity Name"
              value={formData.legalEntity || ""}
              onChange={(value) =>
                setFormData({ ...formData, legalEntity: value })
              }
            />

            <Input
              label="Trading Name"
              value={formData.tradingName || ""}
              onChange={(value) =>
                setFormData({ ...formData, tradingName: value })
              }
            />

            <Input
              label="Company Registration Number"
              value={formData.companyRegistrationNumber || ""}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  companyRegistrationNumber: value,
                })
              }
            />

            <Input
              label="VAT Number"
              value={formData.vatNumber || ""}
              onChange={(value) =>
                setFormData({ ...formData, vatNumber: value })
              }
            />

            <Input
              icon={<User size={18} />}
              label="First Name"
              value={formData.firstName || ""}
              onChange={(value) =>
                setFormData({ ...formData, firstName: value })
              }
            />

            <Input
              label="Last Name"
              value={formData.lastName || ""}
              onChange={(value) =>
                setFormData({ ...formData, lastName: value })
              }
            />

            <Input
              label="Email"
              value={formData.email || ""}
              disabled
              onChange={() => {}}
            />

            <Input
              label="Phone"
              value={formData.phone || ""}
              onChange={(value) =>
                setFormData({ ...formData, phone: value })
              }
            />

            <Input
              label="Job Title"
              value={formData.jobTitle || ""}
              onChange={(value) =>
                setFormData({ ...formData, jobTitle: value })
              }
            />

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-3 rounded-2xl bg-[#006CFF] px-8 py-4 font-bold text-white hover:bg-[#2D8CFF]"
              >
                <Save size={18} />

                {saving ? "Saving..." : "Save Changes"}
              </button>

              {message && (
                <p className="mt-4 text-sm font-semibold text-[#071D49]">
                  {message}
                </p>
              )}
            </div>
          </form>
          {accountType ? <section className="mx-6 mb-6 rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-6 text-[#071D49]">
            <h2 className="text-xl font-bold">Billing &amp; payment terms</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Account type</dt><dd className="font-semibold">{accountType === "TRADE" ? "Trade Account" : accountType === "BUSINESS" ? "Business Account" : "Private Account"}</dd></div>
              <div><dt className="text-slate-500">Accounts email</dt><dd className="break-words font-semibold">{accountsEmail || "Not provided"}</dd></div>
              <div><dt className="text-slate-500">Payment mode</dt><dd className="font-semibold">{accountType === "TRADE" ? "Pay Later / Trade Credit" : "Pay Now"}</dd></div>
              <div><dt className="text-slate-500">Invoice mode</dt><dd className="font-semibold">{accountType === "TRADE" ? "Consolidated - monthly, day 1" : "Per booking"}</dd></div>
            </dl>
            <div className="mt-5 rounded-xl border border-blue-200 bg-white p-4">
              <h3 className="font-bold">{accountType === "TRADE" ? "Trade account payment terms" : "Payment terms"}</h3>
              <p className="mt-2 text-sm leading-6">{accountType === "TRADE" ? TRADE_PAYMENT_NOTICE : "Due immediately"}</p>
              {accountType === "TRADE" ? <p className="mt-2 text-sm leading-6">{TRADE_PAYMENT_EXAMPLE}</p> : null}
            </div>
          </section> : null}
        </section>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  disabled,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#071D49]">
        {icon}
        {label}
      </span>

      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-[#D7E6FF] px-4 py-4 outline-none focus:border-[#006CFF]"
      />
    </label>
  );
}
