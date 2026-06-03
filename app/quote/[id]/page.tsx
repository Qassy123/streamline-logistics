import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  CreditCard,
  MapPin,
  Package,
  ReceiptText,
  Truck,
  User,
} from "lucide-react";

type QuoteDetails = {
  id: string;
  status: string;
  deliveryType: string | null;
  journeyType: string | null;
  capacityPercent: number | null;
  collectionDate: string | null;
  collectionWindow: string | null;
  vehicleSize: string | null;
  collectionAddress: string | null;
  deliveryAddress: string | null;
  extraDrops: unknown;
  loadDescription: string | null;
  fragileGoods: boolean | null;
  contactPreference: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  companyName?: string | null;
  legalEntity?: string | null;
  tradingName?: string | null;
  distanceMiles: string | number | null;
  basePrice: string | number | null;
  fuelSurcharge: string | number | null;
  adminPrice: string | number | null;
  vatAmount: string | number | null;
  totalPrice: string | number | null;
  createdAt?: string;
};

const API_URL = "https://streamline-logistics-production.up.railway.app/api/quotes";

async function getQuote(id: string): Promise<QuoteDetails | null> {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      cache: "no-store",
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error("Failed to fetch quote");
    }

    return response.json();
  } catch (error) {
    console.error("Quote fetch error:", error);
    return null;
  }
}

function formatDate(value: string | null) {
  if (!value) return "Not provided";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(value: string | number | null) {
  const numberValue = Number(value || 0);

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(numberValue);
}

function formatValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function formatExtraDrops(extraDrops: unknown) {
  if (!extraDrops) return [];

  if (Array.isArray(extraDrops)) {
    return extraDrops;
  }

  if (typeof extraDrops === "string") {
    try {
      const parsed = JSON.parse(extraDrops);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

export default async function QuoteDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await getQuote(id);

  if (!quote) {
    notFound();
  }

  const extraDrops = formatExtraDrops(quote.extraDrops);
  const businessName = quote.legalEntity || quote.companyName || "Not provided";

  return (
    <main className="min-h-screen bg-[#070b12] px-6 py-12 text-white">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/quote"
          className="inline-flex items-center gap-2 text-sm font-bold text-amber-300 transition hover:text-amber-200"
        >
          <ArrowLeft size={18} />
          Back to quote form
        </Link>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl shadow-black/30">
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-8 text-white">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">
                  Quote breakdown
                </p>

                <h1 className="mt-3 text-4xl font-bold md:text-6xl">
                  {formatMoney(quote.totalPrice)}
                </h1>

                <p className="mt-4 text-sm text-slate-300">
                  Reference: {quote.id}
                </p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-sm font-bold text-emerald-200">
                  <CheckCircle size={18} />
                  {formatValue(quote.status)}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                <p className="text-sm text-slate-300">Amount due</p>
                <p className="mt-2 text-4xl font-bold">
                  {formatMoney(quote.totalPrice)}
                </p>

                <Link
                  href={`/payments?quoteId=${quote.id}`}
                  className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#ef1c24] px-8 py-4 text-sm font-bold text-white transition hover:bg-[#ff6a00]"
                >
                  <CreditCard size={20} />
                  Proceed To Payment
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-6 bg-white p-6 text-slate-950 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
            <section className="grid gap-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-5 flex items-center gap-3">
                  <Truck className="text-[#ef1c24]" size={24} />
                  <h2 className="text-xl font-bold">Service Details</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Detail label="Delivery Type" value={quote.deliveryType} />
                  <Detail label="Journey Type" value={quote.journeyType} />
                  <Detail label="Vehicle Size" value={quote.vehicleSize} />
                  <Detail
                    label="Capacity Required"
                    value={
                      quote.capacityPercent
                        ? `${quote.capacityPercent}%`
                        : "Not required"
                    }
                  />
                  <Detail
                    label="Collection Date"
                    value={formatDate(quote.collectionDate)}
                  />
                  <Detail
                    label="Collection Window"
                    value={quote.collectionWindow}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-5 flex items-center gap-3">
                  <MapPin className="text-[#ef1c24]" size={24} />
                  <h2 className="text-xl font-bold">Route Details</h2>
                </div>

                <div className="grid gap-4">
                  <AddressBlock
                    label="Collection Address"
                    value={quote.collectionAddress}
                  />

                  <AddressBlock
                    label="Delivery Address"
                    value={quote.deliveryAddress}
                  />

                  {extraDrops.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-bold text-slate-500">
                        Extra Stops
                      </p>

                      <div className="mt-4 grid gap-3">
                        {extraDrops.map((drop, index) => {
                          const stop = drop as {
                            order?: number;
                            address?: string;
                            capacityPercent?: number;
                          };

                          return (
                            <div
                              key={index}
                              className="rounded-2xl bg-slate-50 p-4 text-sm"
                            >
                              <p className="font-bold text-slate-950">
                                Stop {stop.order || index + 2}
                              </p>
                              <p className="mt-1 text-slate-600">
                                {stop.address || "Address not provided"}
                              </p>
                              {stop.capacityPercent && (
                                <p className="mt-2 font-semibold text-slate-800">
                                  Capacity: {stop.capacityPercent}%
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-5 flex items-center gap-3">
                  <Package className="text-[#ef1c24]" size={24} />
                  <h2 className="text-xl font-bold">Load Details</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Detail
                    label="Load Description"
                    value={quote.loadDescription}
                  />
                  <Detail
                    label="Fragile Goods"
                    value={formatValue(quote.fragileGoods)}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-5 flex items-center gap-3">
                  <User className="text-[#ef1c24]" size={24} />
                  <h2 className="text-xl font-bold">Customer Details</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Detail label="Customer Name" value={quote.customerName} />
                  <Detail label="Email" value={quote.customerEmail} />
                  <Detail label="Phone" value={quote.customerPhone} />
                  <Detail
                    label="Contact Preference"
                    value={quote.contactPreference}
                  />
                  <Detail label="Legal Entity" value={businessName} />
                  <Detail label="Trading Name" value={quote.tradingName} />
                </div>
              </div>
            </section>

            <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <div className="mb-5 flex items-center gap-3">
                <ReceiptText className="text-[#ef1c24]" size={24} />
                <h2 className="text-xl font-bold">Price Breakdown</h2>
              </div>

              <div className="grid gap-3">
                <PriceRow
                  label="Estimated Distance"
                  value={`${formatValue(quote.distanceMiles)} miles`}
                />
                <PriceRow label="Base Price" value={formatMoney(quote.basePrice)} />
                <PriceRow
                  label="Fuel Surcharge"
                  value={formatMoney(quote.fuelSurcharge)}
                />
                <PriceRow
                  label="Subtotal Before VAT"
                  value={formatMoney(quote.adminPrice)}
                />
                <PriceRow label="VAT" value={formatMoney(quote.vatAmount)} />

                <div className="mt-3 rounded-2xl bg-slate-950 p-5 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-bold">Total</p>
                    <p className="text-2xl font-bold">
                      {formatMoney(quote.totalPrice)}
                    </p>
                  </div>
                </div>
              </div>

              <Link
                href={`/payments?quoteId=${quote.id}`}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#ef1c24] px-8 py-4 text-sm font-bold text-white transition hover:bg-[#ff6a00]"
              >
                <CreditCard size={20} />
                Proceed To Payment
              </Link>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 break-words text-base font-semibold text-slate-950">
        {formatValue(value)}
      </p>
    </div>
  );
}

function AddressBlock({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 whitespace-pre-line break-words text-base font-semibold leading-7 text-slate-950">
        {formatValue(value)}
      </p>
    </div>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}