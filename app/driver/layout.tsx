import type { Metadata } from "next";
import type { ReactNode } from "react";
import DriverPortalShell from "@/components/driver/DriverPortalShell";

export const metadata: Metadata = {
  title: "Driver Portal | Streamline Logistics Group",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function DriverLayout({ children }: { children: ReactNode }) {
  return <DriverPortalShell>{children}</DriverPortalShell>;
}
