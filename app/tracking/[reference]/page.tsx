import type { Metadata } from "next";
import CustomerTrackingLink from "@/components/CustomerTrackingLink";
export const metadata: Metadata = { title: "Delivery tracking | Streamline Logistics", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function TrackingPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ token?: string | string[] }> }) {
  const { reference } = await params, query = await searchParams;
  return <CustomerTrackingLink reference={reference} token={typeof query.token === "string" ? query.token : ""} />;
}
