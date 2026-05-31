import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Streamline Logistics Group | Business Courier Services UK",
  description:
    "Streamline Logistics Group provides reliable business-to-business courier, same-day delivery, multi-drop, parcel and full-load delivery services across the UK.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}