import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import quoteRoutes from "./routes/quotes";
import vehicleRoutes from "./routes/vehicles";
import bookingRoutes from "./routes/bookings";
import paymentRoutes from "./routes/payments";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/quotes", quoteRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);

app.get("/", (_, res) => {
  res.json({
    success: true,
    message: "Streamline Backend Running",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});