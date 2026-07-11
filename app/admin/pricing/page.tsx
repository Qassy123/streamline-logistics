"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  CircleAlert,
  Loader2,
  RefreshCw,
  Save,
  Truck,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

type PricingConfig = {
  fallbackMilesByService: Record<string, number>;
  pricePerMileByVehicle: Record<string, number>;
  serviceMultiplier: Record<string, number>;
  minimumBasePriceByVehicle: Record<string, number>;
  extraDropFeeByVehicle: Record<string, number>;
  returnJourneyMultiplier: number;
  fuelSurchargeRate: number;
  vatRate: number;
  defaultFallbackMiles: number;
  defaultPricePerMile: number;
  defaultMinimumBasePrice: number;
  defaultExtraDropFee: number;
};

type PricingPayload = {
  config?: PricingConfig;
  vehicleTypes?: string[];
  serviceTypes?: string[];
  result?: {
    distanceMiles: number;
    basePrice: number;
    fuelSurcharge: number;
    adminPrice: number;
    vatAmount: number;
    totalPrice: number;
  };
  valid?: boolean;
  errors?: string[];
  error?: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value || 0);
}

function cloneConfig(config: PricingConfig) {
  return JSON.parse(JSON.stringify(config)) as PricingConfig;
}

export default function AdminPricingPage() {
  const [adminKey, setAdminKey] = useState("");
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<PricingConfig | null>(
    null,
  );
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);

  const [deliveryType, setDeliveryType] = useState("");
  const [journeyType, setJourneyType] = useState("One Way");
  const [vehicleSize, setVehicleSize] = useState("");
  const [distanceMiles, setDistanceMiles] = useState("50");
  const [extraDropCount, setExtraDropCount] = useState("0");
  const [preview, setPreview] = useState<PricingPayload["result"] | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setAdminKey(
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "",
    );
  }, []);

  const loadPricing = useCallback(
    async (refresh = false) => {
      if (!adminKey) {
        setLoading(false);
        setError(
          "Admin key is required. Unlock the admin area from Driver Management.",
        );
        return;
      }

      refresh ? setRefreshing(true) : setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/api/admin/pricing`, {
          headers: {
            "x-admin-key": adminKey,
          },
          cache: "no-store",
        });

        const payload = (await response.json()) as PricingPayload;

        if (!response.ok || !payload.config) {
          throw new Error(payload.error || "Unable to load pricing.");
        }

        setConfig(cloneConfig(payload.config));
        setOriginalConfig(cloneConfig(payload.config));
        setVehicleTypes(payload.vehicleTypes || []);
        setServiceTypes(payload.serviceTypes || []);

        setVehicleSize(
          (payload.vehicleTypes || [])[0] || "",
        );
        setDeliveryType(
          (payload.serviceTypes || [])[0] || "",
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load pricing.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [adminKey],
  );

  useEffect(() => {
    if (adminKey) {
      void loadPricing();
    } else {
      setLoading(false);
    }
  }, [adminKey, loadPricing]);

  const changed = useMemo(() => {
    if (!config || !originalConfig) return false;
    return JSON.stringify(config) !== JSON.stringify(originalConfig);
  }, [config, originalConfig]);

  function updateRecord(
    key: keyof Pick<
      PricingConfig,
      | "fallbackMilesByService"
      | "pricePerMileByVehicle"
      | "serviceMultiplier"
      | "minimumBasePriceByVehicle"
      | "extraDropFeeByVehicle"
    >,
    item: string,
    value: string,
  ) {
    if (!config) return;

    setConfig({
      ...config,
      [key]: {
        ...config[key],
        [item]: Number(value),
      },
    });
  }

  function updateScalar(
    key: keyof Omit<
      PricingConfig,
      | "fallbackMilesByService"
      | "pricePerMileByVehicle"
      | "serviceMultiplier"
      | "minimumBasePriceByVehicle"
      | "extraDropFeeByVehicle"
    >,
    value: string,
  ) {
    if (!config) return;

    setConfig({
      ...config,
      [key]: Number(value),
    });
  }

  async function validateConfiguration() {
    if (!config || !adminKey) return;

    setValidating(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/pricing/validate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify(config),
        },
      );

      const payload = (await response.json()) as PricingPayload;

      if (!response.ok || !payload.valid) {
        throw new Error(
          payload.errors?.join(" ") ||
            payload.error ||
            "Pricing configuration is invalid.",
        );
      }

      setMessage(
        "Pricing configuration is valid. Copy the values into src/lib/pricing.ts, then commit and deploy.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to validate pricing.",
      );
    } finally {
      setValidating(false);
    }
  }

  async function runPreview() {
    if (!config || !adminKey) return;

    setPreviewing(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/pricing/preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            deliveryType,
            journeyType,
            vehicleSize,
            distanceMiles: Number(distanceMiles),
            extraDropCount: Number(extraDropCount),
            config,
          }),
        },
      );

      const payload = (await response.json()) as PricingPayload;

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "Unable to preview price.");
      }

      setPreview(payload.result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to preview price.",
      );
    } finally {
      setPreviewing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF6A00]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1700px]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Admin dashboard
          </Link>

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Commercial controls
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Pricing management
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Review current rates, validate proposed changes and simulate quote
            pricing before deployment.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPricing(true)}
          disabled={refreshing || !adminKey}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
        Pricing is source-controlled in{" "}
        <code>streamline-backend/src/lib/pricing.ts</code>. This page validates
        and previews changes; production rates change only after the file is
        updated, committed and deployed.
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      ) : null}

      {config ? (
        <>
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Global pricing controls
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Rates are decimal values. Use 0.08 for 8% and 0.20 for 20%.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={!changed || validating}
                  onClick={() => {
                    if (originalConfig) {
                      setConfig(cloneConfig(originalConfig));
                    }
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-40"
                >
                  Reset
                </button>

                <button
                  type="button"
                  disabled={validating}
                  onClick={() => void validateConfiguration()}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {validating ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Save size={17} />
                  )}
                  Validate changes
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <NumberField
                label="Return multiplier"
                value={config.returnJourneyMultiplier}
                onChange={(value) =>
                  updateScalar("returnJourneyMultiplier", value)
                }
              />
              <NumberField
                label="Fuel surcharge rate"
                value={config.fuelSurchargeRate}
                onChange={(value) =>
                  updateScalar("fuelSurchargeRate", value)
                }
              />
              <NumberField
                label="VAT rate"
                value={config.vatRate}
                onChange={(value) => updateScalar("vatRate", value)}
              />
              <NumberField
                label="Default fallback miles"
                value={config.defaultFallbackMiles}
                onChange={(value) =>
                  updateScalar("defaultFallbackMiles", value)
                }
              />
              <NumberField
                label="Default price per mile"
                value={config.defaultPricePerMile}
                onChange={(value) =>
                  updateScalar("defaultPricePerMile", value)
                }
              />
              <NumberField
                label="Default minimum base"
                value={config.defaultMinimumBasePrice}
                onChange={(value) =>
                  updateScalar("defaultMinimumBasePrice", value)
                }
              />
              <NumberField
                label="Default extra-drop fee"
                value={config.defaultExtraDropFee}
                onChange={(value) =>
                  updateScalar("defaultExtraDropFee", value)
                }
              />
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <h2 className="text-xl font-bold text-slate-950">
                Vehicle pricing
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Vehicle",
                      "Price per mile",
                      "Minimum base",
                      "Extra drop",
                    ].map((header) => (
                      <th
                        key={header}
                        className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-slate-400"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {vehicleTypes.map((vehicle) => (
                    <tr key={vehicle}>
                      <td className="px-5 py-4 font-bold text-slate-950">
                        {vehicle}
                      </td>
                      <td className="px-5 py-4">
                        <CompactNumber
                          value={config.pricePerMileByVehicle[vehicle]}
                          onChange={(value) =>
                            updateRecord(
                              "pricePerMileByVehicle",
                              vehicle,
                              value,
                            )
                          }
                        />
                      </td>
                      <td className="px-5 py-4">
                        <CompactNumber
                          value={
                            config.minimumBasePriceByVehicle[vehicle]
                          }
                          onChange={(value) =>
                            updateRecord(
                              "minimumBasePriceByVehicle",
                              vehicle,
                              value,
                            )
                          }
                        />
                      </td>
                      <td className="px-5 py-4">
                        <CompactNumber
                          value={config.extraDropFeeByVehicle[vehicle]}
                          onChange={(value) =>
                            updateRecord(
                              "extraDropFeeByVehicle",
                              vehicle,
                              value,
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <h2 className="text-xl font-bold text-slate-950">
                Service pricing
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    {["Service", "Fallback miles", "Multiplier"].map(
                      (header) => (
                        <th
                          key={header}
                          className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-slate-400"
                        >
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {serviceTypes.map((service) => (
                    <tr key={service}>
                      <td className="px-5 py-4 font-bold text-slate-950">
                        {service}
                      </td>
                      <td className="px-5 py-4">
                        <CompactNumber
                          value={config.fallbackMilesByService[service]}
                          onChange={(value) =>
                            updateRecord(
                              "fallbackMilesByService",
                              service,
                              value,
                            )
                          }
                        />
                      </td>
                      <td className="px-5 py-4">
                        <CompactNumber
                          value={config.serviceMultiplier[service]}
                          onChange={(value) =>
                            updateRecord(
                              "serviceMultiplier",
                              service,
                              value,
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
                <Calculator size={21} />
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Price simulator
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Test the edited values without changing production pricing.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              <SelectField
                label="Service"
                value={deliveryType}
                onChange={setDeliveryType}
                options={serviceTypes}
              />
              <SelectField
                label="Journey"
                value={journeyType}
                onChange={setJourneyType}
                options={["One Way", "Return", "Multi Drop"]}
              />
              <SelectField
                label="Vehicle"
                value={vehicleSize}
                onChange={setVehicleSize}
                options={vehicleTypes}
              />
              <TextNumber
                label="Distance miles"
                value={distanceMiles}
                onChange={setDistanceMiles}
              />
              <TextNumber
                label="Extra drops"
                value={extraDropCount}
                onChange={setExtraDropCount}
              />
            </div>

            <button
              type="button"
              disabled={previewing}
              onClick={() => void runPreview()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {previewing ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Calculator size={17} />
              )}
              Calculate preview
            </button>

            {preview ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                <ResultCard
                  label="Distance"
                  value={`${preview.distanceMiles} mi`}
                />
                <ResultCard
                  label="Base"
                  value={money(preview.basePrice)}
                />
                <ResultCard
                  label="Fuel"
                  value={money(preview.fuelSurcharge)}
                />
                <ResultCard
                  label="Net"
                  value={money(preview.adminPrice)}
                />
                <ResultCard
                  label="VAT"
                  value={money(preview.vatAmount)}
                />
                <ResultCard
                  label="Total"
                  value={money(preview.totalPrice)}
                  highlight
                />
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
      />
    </label>
  );
}

function CompactNumber({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="number"
      step="0.01"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-32 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00]"
    />
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
      />
    </label>
  );
}

function ResultCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-orange-300 bg-orange-50"
          : "border-slate-200"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}