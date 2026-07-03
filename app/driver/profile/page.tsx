"use client";

import { useEffect, useState } from "react";
import { Mail, Phone, Truck, User, Shield, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

const API_BASE = "https://streamline-logistics-production.up.railway.app";

export default function DriverProfilePage() {
  const router = useRouter();
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const token = localStorage.getItem("driverToken");

      if (!token) {
        router.push("/driver/login");
        return;
      }

      const response = await fetch(`${API_BASE}/api/driver/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem("driverToken");
        router.push("/driver/login");
        return;
      }

      const data = await response.json();
      setDriver(data.driver);
      setLoading(false);
    }

    loadProfile();
  }, [router]);

  async function logout() {
    const token = localStorage.getItem("driverToken");

    if (token) {
      await fetch(`${API_BASE}/api/driver/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {});
    }

    localStorage.removeItem("driverToken");
    localStorage.removeItem("driver");
    router.push("/driver/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100">
        Loading profile...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl p-8">
        <div className="rounded-3xl bg-[#07182f] p-8 text-white">
          <h1 className="text-4xl font-bold">Driver Profile</h1>
          <p className="mt-2 text-blue-100">
            View your account, assigned vehicle and availability.
          </p>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card icon={<User size={20} />} title="Name" value={driver?.name} />
          <Card icon={<Mail size={20} />} title="Email" value={driver?.email} />
          <Card icon={<Phone size={20} />} title="Phone" value={driver?.phone || "Not set"} />
          <Card icon={<Shield size={20} />} title="Availability" value={driver?.availability} />
          <Card
            icon={<Truck size={20} />}
            title="Assigned Vehicle"
            value={
              driver?.vehicle
                ? `${driver.vehicle.name} (${driver.vehicle.registration ?? "No Registration"})`
                : "No vehicle assigned"
            }
          />
        </div>

        <button
          onClick={logout}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </main>
  );
}

function Card({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3 text-[#18a8ff]">
        {icon}
        <h2 className="font-semibold">{title}</h2>
      </div>

      <p className="mt-4 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
