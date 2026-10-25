"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const tabs = [{ href: "/admin/reports", label: "Reports" }, { href: "/admin/reports/audit-history", label: "Audit History" }, { href: "/admin/reports/documents", label: "Documents" }];
export default function ReportsNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Reports sections" className="mx-auto mb-6 flex max-w-[1800px] flex-wrap gap-2">{tabs.map(tab => <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined} className={`min-h-11 rounded-xl border px-5 py-3 text-sm font-bold ${pathname === tab.href ? "border-[#FF6A00] bg-[#FF6A00] text-white" : "border-slate-300 bg-white text-slate-900"}`}>{tab.label}</Link>)}</nav>;
}
