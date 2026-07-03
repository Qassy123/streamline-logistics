"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Mail, Truck } from "lucide-react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function DriverLoginPage() {
  const router = useRouter();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/driver/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          login: login.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Driver login failed");
      }

      localStorage.setItem("driverToken", data.token);
      localStorage.setItem("driver", JSON.stringify(data.driver));

      router.push("/driver/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Driver login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="hidden bg-gradient-to-br from-slate-900 via-slate-950 to-black p-12 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-950">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">Streamline</p>
              <p className="text-sm text-slate-400">Driver Portal</p>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Operations
            </p>
            <h1 className="text-5xl font-bold leading-tight tracking-tight">
              Manage assigned jobs, tracking and proof of delivery from one place.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Access today&apos;s jobs, update collection and delivery statuses,
              start live tracking and complete proof of delivery.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Live jobs
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              GPS tracking
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              POD capture
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-950">
                <Truck className="h-6 w-6" />
              </div>
              <p className="text-2xl font-bold">Streamline Driver Portal</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/30 sm:p-8">
              <div className="mb-8">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Driver login
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight">
                  Sign in to your route
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Use your driver username or email address.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="login"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Username or email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                    <input
                      id="login"
                      type="text"
                      value={login}
                      onChange={(event) => setLogin(event.target.value)}
                      autoComplete="username"
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/80 py-4 pl-12 pr-4 text-white outline-none transition placeholder:text-slate-500 focus:border-white/30 focus:ring-4 focus:ring-white/10"
                      placeholder="driver@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/80 py-4 pl-12 pr-12 text-white outline-none transition placeholder:text-slate-500 focus:border-white/30 focus:ring-4 focus:ring-white/10"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <a
                    href="/driver/forgot-username"
                    className="text-slate-300 underline-offset-4 hover:text-white hover:underline"
                  >
                    Forgot username
                  </a>
                  <a
                    href="/driver/forgot-password"
                    className="text-slate-300 underline-offset-4 hover:text-white hover:underline"
                  >
                    Forgot password
                  </a>
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-white px-5 py-4 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              Driver access only. Customer accounts use the customer login area.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
