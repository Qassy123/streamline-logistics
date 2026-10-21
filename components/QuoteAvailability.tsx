"use client";

import { useEffect, useState, type ReactNode } from "react";
import { checkQuoteAvailability, isQuoteFormUrl, QUOTE_MAINTENANCE_MESSAGE } from "@/lib/quoteAvailability";

// All quote links (header, mobile menu, hero, floating button, footer and services)
// are checked before navigation, including links mounted after this component.
export function QuoteNavigationGuard({ children }: { children: ReactNode }) {
  useEffect(() => {
    let controller: AbortController | null = null;
    function click(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;
      controller?.abort(); controller = null;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !isQuoteFormUrl(link.href, window.location.href)) return;
      event.preventDefault(); event.stopPropagation();
      const request = new AbortController(); controller = request;
      const timeout = window.setTimeout(() => request.abort(), 8000);
      void checkQuoteAvailability(request.signal).then(available => {
        if (request.signal.aborted) return;
        if (!available) window.alert(QUOTE_MAINTENANCE_MESSAGE);
        else window.location.assign(link.href);
      }).catch(() => {
        if (!request.signal.aborted) window.alert("Unable to check quote availability. Please try again or call 0333 344 0703.");
        else if (controller === request) window.alert("Quote availability could not be checked. Please try again or call 0333 344 0703.");
      }).finally(() => { window.clearTimeout(timeout); if (controller === request) controller = null; });
    }
    document.addEventListener("click", click, true);
    return () => { controller?.abort(); controller = null; document.removeEventListener("click", click, true); };
  }, []);
  return <>{children}</>;
}

// Direct URLs, bookmarks and new tabs never mount the form until the live
// maintenance check explicitly permits it. Failed checks also keep it closed.
export function QuoteAvailabilityGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"CHECKING" | "OPEN" | "CLOSED" | "ERROR">("CHECKING");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true, controller: AbortController | null = null;
    async function refresh() {
      controller?.abort(); const current = new AbortController(); controller = current;
      const timeout = window.setTimeout(() => current.abort(), 8000);
      try {
        const available = await checkQuoteAvailability(current.signal);
        if (active && controller === current) setStatus(available ? "OPEN" : "CLOSED");
      } catch { if (active && controller === current) setStatus("ERROR"); }
      finally { window.clearTimeout(timeout); }
    }
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 30000);
    window.addEventListener("focus", refresh);
    return () => { active = false; controller?.abort(); window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [retry]);
  if (status === "OPEN") return <>{children}</>;
  return <main className="min-h-screen bg-[#F4F8FF] px-4 py-12 text-[#071D49] sm:px-6">
    <section className="mx-auto max-w-2xl rounded-2xl border border-amber-300 bg-white p-6 shadow-sm sm:p-8" aria-live="polite">
      <p className="text-sm font-bold uppercase tracking-wide text-amber-800">{status === "CHECKING" ? "Checking availability" : "Online quoting"}</p>
      <h1 className="mt-3 text-2xl font-bold">{status === "CHECKING" ? "Checking whether online quotes are available…" : status === "ERROR" ? "Unable to check quote availability" : "Online quotes are temporarily unavailable"}</h1>
      {status !== "CHECKING" && <>
        <p className="mt-4 leading-7">{status === "ERROR" ? "Please try again or call our team for a quote." : QUOTE_MAINTENANCE_MESSAGE}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a className="inline-flex min-h-11 items-center rounded-full bg-[#006CFF] px-6 py-3 font-bold text-white" href="tel:03333440703">Call 0333 344 0703</a>
          <a className="inline-flex min-h-11 items-center rounded-full border px-6 py-3 font-semibold" href="/">Back to website</a>
          <button type="button" className="min-h-11 px-3 font-semibold underline" onClick={() => { setStatus("CHECKING"); setRetry(value => value + 1); }}>Check again</button>
        </div>
      </>}
    </section>
  </main>;
}
