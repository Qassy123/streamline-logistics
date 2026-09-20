import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

import quoteRoutes from "./routes/quotes";
import vehicleRoutes from "./routes/vehicles";
import bookingRoutes from "./routes/bookings";
import paymentRoutes from "./routes/payments";
import distanceRoutes from "./routes/distance";
import accountRoutes from "./routes/accounts";
import tradeAccountRoutes from "./routes/tradeAccounts";
import savedRouteRoutes from "./routes/savedRoutes";
import trackingRoutes from "./routes/tracking";
import contactRoutes from "./routes/contact";
import invoiceRoutes from "./routes/invoices";

// Driver Routes
import driverAuthRoutes from "./routes/driverAuth";
import driverJobsRoutes from "./routes/driverJobs";
import driverTrackingRoutes from "./routes/driverTracking";
import driverPodRoutes from "./routes/driverPod";

// Admin Routes
import adminDriverRoutes from "./routes/adminDrivers";
import adminCustomerRoutes from "./routes/adminCustomers";
import adminPlanningRoutes from "./routes/adminPlanning";
import adminReportsRoutes from "./routes/adminReports";
import adminNotificationRoutes from "./routes/adminNotifications";
import adminAuditRoutes from "./routes/adminAudit";
import adminPricingRoutes from "./routes/adminPricing";
import adminDocumentsRoutes from "./routes/adminDocuments";
import adminSearchRoutes from "./routes/adminSearch";
import adminPermissionsRoutes from "./routes/adminPermissions";
import adminSettingsRoutes from "./routes/adminSettings";
import adminTariffRoutes from "./routes/adminTariffs";
import adminDiscountRoutes from "./routes/adminDiscounts";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

const app = express();

app.use(cors());
app.use(express.json());

/* ---------------------------------
   Customer Routes
---------------------------------- */

app.use("/api/quotes", quoteRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/distance", distanceRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/trade-accounts", tradeAccountRoutes);
app.use("/api/saved-routes", savedRouteRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/invoices", invoiceRoutes);

/* ---------------------------------
   Driver Routes
---------------------------------- */

app.use("/api/driver/auth", driverAuthRoutes);
app.use("/api/driver/jobs", driverJobsRoutes);
app.use("/api/driver/tracking", driverTrackingRoutes);
app.use("/api/driver/pod", driverPodRoutes);

/* ---------------------------------
   Admin Routes
---------------------------------- */

app.use("/api/admin/drivers", adminDriverRoutes);
app.use("/api/admin/customers", adminCustomerRoutes);
app.use("/api/admin/planning", adminPlanningRoutes);
app.use("/api/admin/reports", adminReportsRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);
app.use("/api/admin/audit", adminAuditRoutes);
app.use("/api/admin/pricing", adminPricingRoutes);
app.use("/api/admin/documents", adminDocumentsRoutes);
app.use("/api/admin/search", adminSearchRoutes);
app.use("/api/admin/permissions", adminPermissionsRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/admin/tariffs", adminTariffRoutes);
app.use("/api/admin/discounts", adminDiscountRoutes);

/* ---------------------------------
   Health Check
---------------------------------- */

app.get("/", (_request, response) => {
  response.json({
    success: true,
    message: "Streamline Backend Running",
    version: "1.0",
  });
});

const PORT = process.env.PORT || 5000;
const INVOICE_REMINDER_INTERVAL_MS = 60 * 60 * 1000;
const INVOICE_REMINDER_INITIAL_DELAY_MS = 60 * 1000;
const BILLING_CYCLE_INTERVAL_MS = 60 * 60 * 1000;
const BILLING_CYCLE_INITIAL_DELAY_MS = 90 * 1000;

async function processInvoiceReminders() {
  const adminKey = process.env.ADMIN_API_KEY?.trim();

  if (!adminKey) {
    console.warn(
      "Invoice reminder processing skipped because ADMIN_API_KEY is not configured.",
    );
    return;
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${PORT}/api/invoices/admin/process-reminders`,
      {
        method: "POST",
        headers: {
          "x-admin-key": adminKey,
        },
      },
    );

    const payload = (await response.json()) as {
      success?: boolean;
      sent?: number;
      skipped?: number;
      failures?: Array<{ invoiceNumber: string; error: string }>;
      error?: string;
    };

    if (!response.ok) {
      console.error(
        "Invoice reminder processing failed:",
        payload.error || `HTTP ${response.status}`,
      );
      return;
    }

    console.log(
      `Invoice reminders processed. Sent: ${payload.sent ?? 0}, skipped: ${payload.skipped ?? 0}, failures: ${payload.failures?.length ?? 0}.`,
    );

    if (payload.failures?.length) {
      console.error("Invoice reminder failures:", payload.failures);
    }
  } catch (error) {
    console.error("Invoice reminder scheduler error:", error);
  }
}

async function processAutomaticBillingCycles() {
  const adminKey = process.env.ADMIN_API_KEY?.trim();

  if (!adminKey) {
    console.warn(
      "Automatic billing-cycle processing skipped because ADMIN_API_KEY is not configured.",
    );
    return;
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${PORT}/api/invoices/admin/process-billing-cycles`,
      {
        method: "POST",
        headers: {
          "x-admin-key": adminKey,
        },
      },
    );

    const payload = (await response.json()) as {
      success?: boolean;
      created?: Array<{
        invoiceNumber: string;
        bookingCount: number;
        invoiceType: string;
      }>;
      skipped?: Array<{ userId: string; reason: string }>;
      failures?: Array<{ userId: string; error: string }>;
      error?: string;
    };

    if (!response.ok) {
      console.error(
        "Automatic billing-cycle processing failed:",
        payload.error || `HTTP ${response.status}`,
      );
      return;
    }

    console.log(
      `Automatic billing cycles processed. Created: ${payload.created?.length ?? 0}, skipped: ${payload.skipped?.length ?? 0}, failures: ${payload.failures?.length ?? 0}.`,
    );

    if (payload.failures?.length) {
      console.error("Automatic billing-cycle failures:", payload.failures);
    }
  } catch (error) {
    console.error("Automatic billing-cycle scheduler error:", error);
  }
}

app.listen(PORT, () => {
  console.log(`Streamline Backend running on port ${PORT}`);

  setTimeout(() => {
    void processInvoiceReminders();

    setInterval(() => {
      void processInvoiceReminders();
    }, INVOICE_REMINDER_INTERVAL_MS);
  }, INVOICE_REMINDER_INITIAL_DELAY_MS);

  setTimeout(() => {
    void processAutomaticBillingCycles();

    setInterval(() => {
      void processAutomaticBillingCycles();
    }, BILLING_CYCLE_INTERVAL_MS);
  }, BILLING_CYCLE_INITIAL_DELAY_MS);
});
