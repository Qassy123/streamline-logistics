import type { ReactNode } from "react";
import ReportsNavigation from "@/components/admin/ReportsNavigation";
export default function ReportsLayout({ children }: { children: ReactNode }) {
  return <><ReportsNavigation />{children}</>;
}
