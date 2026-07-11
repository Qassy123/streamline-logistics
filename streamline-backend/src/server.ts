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

// Driver Routes
import driverAuthRoutes from "./routes/driverAuth";
import driverJobsRoutes from "./routes/driverJobs";
import driverTrackingRoutes from "./routes/driverTracking";
import driverPodRoutes from "./routes/driverPod";
import invoiceRoutes from "./routes/invoices";

// Admin Routes
import adminDriverRoutes from "./routes/adminDrivers";
import adminCustomerRoutes from "./routes/adminCustomers";

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

/* ---------------------------------
   Health Check
---------------------------------- */

app.get("/", (_, res) => {
  res.json({
    success: true,
    message: "Streamline Backend Running",
    version: "1.0",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚛 Streamline Backend running on port ${PORT}`);
});