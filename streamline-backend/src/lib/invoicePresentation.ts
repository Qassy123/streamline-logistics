import { Prisma } from "@prisma/client";

type ServiceBooking = Prisma.BookingGetPayload<{ include: { quote: true } }>;
const text = (value: unknown) => value === null || value === undefined ? "" : String(value).trim();
export function pdfText(value: string) {
  return value.replace(/→|⇒/g, " to ").replace(/[–—‑]/g, "-").replace(/\u00a0/g, " ");
}
function address(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const row = value as Record<string, unknown>;
  if (typeof row.address === "string" && row.address.trim()) return row.address.trim();
  return [row.addressLine1, row.addressLine2, row.townCity, row.county, row.postcode].map(text).filter(Boolean).join(", ");
}
export function orderedRoute(booking: Pick<ServiceBooking, "collectionAddress" | "deliveryAddress" | "extraDrops" | "returnAddress" | "journeyType" | "quote">) {
  const quote = booking.quote;
  const extra = booking.extraDrops ?? quote?.extraDrops;
  const drops = Array.isArray(extra) ? extra.map((drop, index) => ({ drop, index,
    order: drop && typeof drop === "object" && !Array.isArray(drop) ? Number((drop as Record<string, unknown>).order ?? index + 2) : index + 2,
  })).sort((a, b) => a.order - b.order || a.index - b.index).map(row => address(row.drop)).filter(Boolean) : [];
  const route = [`Collection: ${booking.collectionAddress || quote?.collectionAddress || "Not recorded"}`,
    `Delivery: ${booking.deliveryAddress || quote?.deliveryAddress || "Not recorded"}`,
    ...drops.map((drop, i) => `Additional stop ${i + 1}: ${drop}`)];
  const returnAddress = booking.returnAddress || quote?.returnAddress;
  if (returnAddress) route.push(`Return: ${returnAddress}`);
  return route;
}
export function invoiceServiceDetails(booking: ServiceBooking): string[] {
  const q = booking.quote;
  const label = (value: unknown) => text(value).replace(/_/g, " ");
  const values = [
    ...orderedRoute(booking),
    `Collection: ${new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", year: "numeric" }).format(booking.collectionDate)}${booking.collectionWindow ? `, ${booking.collectionWindow}` : ""}`,
    q?.deliveryType ? `Service: ${label(q.deliveryType)}` : null,
    booking.journeyType || q?.journeyType ? `Journey type: ${label(booking.journeyType || q?.journeyType)}` : null,
    booking.vehicleType || q?.vehicleSize ? `Vehicle: ${booking.vehicleType || q?.vehicleSize}` : null,
    booking.customerReference || q?.customerReference ? `Customer reference: ${booking.customerReference || q?.customerReference}` : null,
    booking.purchaseOrderNumber || q?.purchaseOrderNumber ? `PO / order reference: ${booking.purchaseOrderNumber || q?.purchaseOrderNumber}` : null,
    q?.whatAreWeCollecting ? `Goods: ${label(q.whatAreWeCollecting)}` : null,
    q?.loadDescription ? `Load: ${q.loadDescription}` : null,
    q?.palletCount !== null && q?.palletCount !== undefined ? `Pallets: ${q.palletCount}` : null,
    q?.fragileGoods ? "Fragile goods: Yes" : null,
    q?.capacityPercent !== null && q?.capacityPercent !== undefined ? `Load capacity: ${q.capacityPercent}%` : null,
    q?.returnCapacityPercent !== null && q?.returnCapacityPercent !== undefined ? `Return load capacity: ${q.returnCapacityPercent}%` : null,
    q?.distanceMiles !== null && q?.distanceMiles !== undefined ? `Distance: ${q.distanceMiles} miles` : null,
    q?.specialInstructions ? `Special instructions: ${q.specialInstructions}` : null,
    q?.handoverContactName || q?.handoverContactPhone ? `Handover contact: ${[q.handoverContactName, q.handoverContactPhone].filter(Boolean).join(" / ")}` : null,
    q?.handoverNotes ? `Handover notes: ${q.handoverNotes}` : null,
    q?.discountReason ? `Quote discount reason: ${q.discountReason}` : null,
    q?.basePrice !== null && q?.basePrice !== undefined ? `Quoted base fare (net): GBP ${Number(q.basePrice).toFixed(2)}` : null,
    q?.fuelSurcharge !== null && q?.fuelSurcharge !== undefined ? `Quoted fuel surcharge (net): GBP ${Number(q.fuelSurcharge).toFixed(2)}` : null,
    q?.adminPrice !== null && q?.adminPrice !== undefined ? `Quoted subtotal before discount (net, includes base and fuel): GBP ${Number(q.adminPrice).toFixed(2)}` : null,
    q?.discountAmount && Number(q.discountAmount) !== 0 ? `Quote discount (net): GBP ${Number(q.discountAmount).toFixed(2)}` : null,
  ];
  return values.filter((value): value is string => Boolean(value)).map(pdfText);
}
