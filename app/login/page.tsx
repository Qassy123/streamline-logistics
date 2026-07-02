"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, LogIn } from "lucide-react";

const API_URL =
  "https://streamline-logistics-production.up.railway.app/api/accounts/login";

const AUTH_TOKEN_STORAGE_KEY = "streamline_auth_token";
const AUTH_USER_STORAGE_KEY = "streamline_auth_user";

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed.");
      }

      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, data.token);
      localStorage.setItem(
        AUTH_USER_STORAGE_KEY,
        JSON.stringify(data.user)
      );

      window.dispatchEvent(new Event("streamline-auth-change"));

      router.push("/dashboard");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to log in."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-10 text-[#071D49]">
      <div className="mx-auto max-w-2xl">
        <section className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-8 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
              Account Access
            </p>

            <h1 className="mt-4 text-4xl font-bold">
              Login
            </h1>

            <p className="mt-4 text-sm text-white/75">
              Access your bookings, tracking, invoices and saved routes.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-6 p-8">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                {error}
              </div>
            )}

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Mail size={16} />
                Email or Username
              </span>

              <input
                type="text"
                required
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none focus:border-[#006CFF]"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Lock size={16} />
                Password
              </span>

              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none focus:border-[#006CFF]"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,_#071D49_0%,_#0B2A63_50%,_#006CFF_100%)] px-8 py-5 font-bold text-white disabled:opacity-50"
            >
              <LogIn size={20} />

              {loading ? "Logging In..." : "Login"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
