import { emailLayout, sendEmail } from "./email";

type BookingEmailInput = {
  id: string;
  reference: string;
  collectionDate: Date;
  collectionWindow: string;
  collectionAddress: string;
  deliveryAddress: string;
  totalPrice: unknown;
  quote?: {
    customerName?: string | null;
    customerEmail?: string | null;
    vehicleSize?: string | null;
    totalPrice?: unknown;
    companyName?: string | null;
    legalEntity?: string | null;
    tradingName?: string | null;
  } | null;
  vehicle?: {
    vehicleType?: string | null;
    registration?: string | null;
  } | null;
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(date));
}

function formatMoney(value: unknown) {
  if (value === null || value === undefined) return "Not provided";

  const amount = Number(value);

  if (Number.isNaN(amount)) return "Not provided";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

function getCustomerEmail(booking: BookingEmailInput) {
  return booking.quote?.customerEmail || booking.user?.email || "";
}

function getCustomerName(booking: BookingEmailInput) {
  return booking.quote?.customerName || booking.user?.name || "Customer";
}

function getCustomerBusinessName(booking: BookingEmailInput) {
  return (
    booking.quote?.tradingName ||
    booking.quote?.companyName ||
    booking.quote?.legalEntity ||
    ""
  );
}

function getCustomerGreeting(booking: BookingEmailInput) {
  const customerName = getCustomerName(booking);
  const businessName = getCustomerBusinessName(booking);

  if (businessName) {
    return `${businessName} (contact: ${customerName})`;
  }

  return customerName;
}

function getVehicleName(booking: BookingEmailInput) {
  return (
    booking.vehicle?.vehicleType ||
    booking.quote?.vehicleSize ||
    "Vehicle pending"
  );
}


function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]!));
}

function detailRow(label: string, value: unknown): string {
  return '<tr><td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;width:34%;vertical-align:top;color:#64748b;font-size:13px;">' + escapeHtml(label) +
    '</td><td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#071D49;font-size:14px;font-weight:600;word-break:break-word;">' + escapeHtml(value) + '</td></tr>';
}

function summaryTable(rows: string): string {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-collapse:collapse;margin:20px 0;background:#f8fafc;">' + rows + '</table>';
}

function amountCard(booking: BookingEmailInput, label: string): string {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#071D49;"><tr><td style="padding:20px;color:#ffffff;"><p style="margin:0 0 6px;font-size:13px;color:#cbd5e1;">' + escapeHtml(label) +
    '</p><p style="margin:0;font-size:30px;font-weight:700;color:#ffffff;">' + escapeHtml(formatMoney(booking.quote?.totalPrice ?? booking.totalPrice)) + '</p></td></tr></table>';
}

function journeySummary(booking: BookingEmailInput): string {
  return summaryTable(
    detailRow("Booking reference", booking.reference) +
    detailRow("Vehicle", getVehicleName(booking)) +
    detailRow("Collection date", formatDate(booking.collectionDate)) +
    detailRow("Collection window", booking.collectionWindow) +
    detailRow("Collection address", booking.collectionAddress) +
    detailRow("Delivery address", booking.deliveryAddress)
  );
}

export async function sendCustomerBookingConfirmedEmail(booking: BookingEmailInput) {
  const customerEmail = getCustomerEmail(booking);
  if (!customerEmail) { console.warn("Customer booking email skipped: missing customer email"); return; }
  await sendEmail({
    to: customerEmail,
    department: "bookings",
    subject: `Booking confirmed - ${booking.reference}`,
    html: emailLayout("Your booking is confirmed", `
      <p>Hello ${escapeHtml(getCustomerGreeting(booking))},</p>
      <p>Thank you for choosing Streamline Logistics Group. Your booking is confirmed. Please check the journey details below.</p>
      ${journeySummary(booking)}
      ${amountCard(booking, "Booking total")}
      <p>We will keep you informed as your booking progresses. If you need to change any details, reply to this email and include your booking reference.</p>
      <p>Kind regards,<br/><strong>Bookings Team</strong><br/>Streamline Logistics Group</p>
    `, "bookings"),
  });
}

export async function sendCustomerPaymentSuccessfulEmail(booking: BookingEmailInput) {
  const customerEmail = getCustomerEmail(booking);
  if (!customerEmail) { console.warn("Payment email skipped: missing customer email"); return; }
  await sendEmail({
    to: customerEmail,
    department: "accounts",
    subject: `Payment received - ${booking.reference}`,
    html: emailLayout("Payment received", `
      <p>Hello ${escapeHtml(getCustomerGreeting(booking))},</p>
      <p>Thank you. We have received your payment for the booking below.</p>
      ${summaryTable(detailRow("Booking reference", booking.reference))}
      ${amountCard(booking, "Amount paid")}
      <p>Your booking is confirmed. For questions about this payment, reply to this email and quote your booking reference.</p>
      <p>Kind regards,<br/><strong>Accounts Team</strong><br/>Streamline Logistics Group</p>
    `, "accounts"),
  });
}

export async function sendAdminNewPaidBookingEmail(booking: BookingEmailInput) {
  await sendEmail({
    to: "operations@streamlinelogisticsgroup.co.uk",
    department: "operations",
    subject: `New paid booking - ${booking.reference}`,
    html: emailLayout("New paid booking", `
      <p>A new paid booking is ready for operational review.</p>
      ${summaryTable(detailRow("Customer", getCustomerGreeting(booking)) + detailRow("Customer email", getCustomerEmail(booking) || "Not provided"))}
      ${journeySummary(booking)}
      ${amountCard(booking, "Booking total")}
      <p>Review the booking in the admin portal and arrange the vehicle and driver assignment.</p>
    `, "operations"),
  });
}
