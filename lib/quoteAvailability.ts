const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "https://streamline-logistics-production.up.railway.app").replace(/\/$/, "");
export const QUOTE_MAINTENANCE_MESSAGE = "Online quotes are temporarily unavailable while we carry out maintenance. Please call 07301827224 for a quote.";
export async function checkQuoteAvailability(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/admin/settings/downtime`, { cache: "no-store", signal });
  const data = await response.json();
  if (!response.ok || typeof data.websiteDowntime !== "boolean") throw new Error("Unable to check quote availability. Please try again or call 07301827224.");
  return !data.websiteDowntime;
}
export function isQuoteFormUrl(href: string, base: string) {
  try { const url = new URL(href, base), origin = new URL(base).origin; return url.origin === origin && ["/quote", "/instant-quote"].includes(url.pathname.replace(/\/$/, "")); }
  catch { return false; }
}
