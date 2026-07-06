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

function getVehicleName(booking: BookingEmailInput) {
  return (
    booking.vehicle?.vehicleType ||
    booking.quote?.vehicleSize ||
    "Vehicle pending"
  );
}

export async function sendCustomerBookingConfirmedEmail(
  booking: BookingEmailInput,
) {
  const customerEmail = getCustomerEmail(booking);

  if (!customerEmail) {
    console.warn("Customer booking email skipped: missing customer email");
    return;
  }

  await sendEmail({
    to: customerEmail,
    subject: `Booking confirmed - ${booking.reference}`,
    html: emailLayout(
      "Booking Confirmed",
      `
        <p>Hi ${getCustomerName(booking)},</p>

        <p>Your booking has been confirmed successfully.</p>

        <p><strong>Booking reference:</strong> ${booking.reference}</p>
        <p><strong>Vehicle:</strong> ${getVehicleName(booking)}</p>
        <p><strong>Collection date:</strong> ${formatDate(booking.collectionDate)}</p>
        <p><strong>Collection window:</strong> ${booking.collectionWindow}</p>
        <p><strong>Collection address:</strong><br/>${booking.collectionAddress}</p>
        <p><strong>Delivery address:</strong><br/>${booking.deliveryAddress}</p>
        <p><strong>Total paid:</strong> ${formatMoney(booking.quote?.totalPrice || booking.totalPrice)}</p>

        <p>We'll keep you updated as your booking progresses.</p>

        <p>Kind regards,<br/>Streamline Logistics Group</p>
      `,
    ),
  });
}

export async function sendCustomerPaymentSuccessfulEmail(
  booking: BookingEmailInput,
) {
  const customerEmail = getCustomerEmail(booking);

  if (!customerEmail) {
    console.warn("Payment email skipped: missing customer email");
    return;
  }

  await sendEmail({
    to: customerEmail,
    subject: `Payment received - ${booking.reference}`,
    html: emailLayout(
      "Payment Received",
      `
        <p>Hi ${getCustomerName(booking)},</p>

        <p>Your payment has been received successfully.</p>

        <p><strong>Booking reference:</strong> ${booking.reference}</p>
        <p><strong>Amount paid:</strong> ${formatMoney(booking.quote?.totalPrice || booking.totalPrice)}</p>

        <p>Your booking is now confirmed.</p>

        <p>Kind regards,<br/>Streamline Logistics Group</p>
      `,
    ),
  });
}

export async function sendAdminNewPaidBookingEmail(booking: BookingEmailInput) {
  await sendEmail({
    to: "info@streamlinelogisticsgroup.co.uk",
    subject: `New paid booking - ${booking.reference}`,
    html: emailLayout(
      "New Paid Booking",
      `
        <p><strong>Booking reference:</strong> ${booking.reference}</p>
        <p><strong>Customer:</strong> ${getCustomerName(booking)}</p>
        <p><strong>Email:</strong> ${getCustomerEmail(booking) || "Not provided"}</p>
        <p><strong>Vehicle:</strong> ${getVehicleName(booking)}</p>
        <p><strong>Collection date:</strong> ${formatDate(booking.collectionDate)}</p>
        <p><strong>Collection window:</strong> ${booking.collectionWindow}</p>
        <p><strong>Collection address:</strong><br/>${booking.collectionAddress}</p>
        <p><strong>Delivery address:</strong><br/>${booking.deliveryAddress}</p>
        <p><strong>Total:</strong> ${formatMoney(booking.quote?.totalPrice || booking.totalPrice)}</p>
      `,
    ),
  });
}