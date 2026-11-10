"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminFetch } from "@/lib/adminFetch";

const endpoint = "/api/admin/assistant";

export default function AskStreamline() {
  const pagePath = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [links, setLinks] = useState<{ href: string; label: string }[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const request = new AbortController();
    adminFetch(endpoint, { signal: request.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!request.signal.aborted) setEnabled(data?.enabled === true); })
      .catch(() => {});
    return () => request.abort();
  }, []);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || question.trim().length < 2) return;
    setPending(true);
    setError("");
    setAnswer("");
    setLinks([]);
    try {
      const response = await adminFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, pagePath }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ask Streamline is unavailable.");
      setAnswer(data.answer);
      setLinks(data.links);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ask Streamline is unavailable.");
    } finally {
      setPending(false);
    }
  }

  if (!enabled) return null;

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()}
        className="min-h-11 whitespace-nowrap rounded-lg border border-[#7FB6FF] bg-[#EAF2FF] px-4 text-sm font-semibold text-[#071D49] transition-colors hover:bg-[#D7E6FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006CFF]">
        Ask Streamline
      </button>
      <dialog ref={dialog} aria-labelledby="ask-streamline-title"
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-[#D7E6FF] bg-white p-0 text-[#071D49] shadow-2xl backdrop:bg-[#071D49]/65">
        <header className="flex items-center justify-between gap-3 border-b-4 border-[#006CFF] bg-[#071D49] px-5 py-2 sm:px-7">
          <div className="relative h-14 w-52 max-w-full overflow-hidden">
            <Image src="/images/logos/header-logo.png" alt="Streamline Logistics Group" width={1536} height={1024}
              sizes="240px" className="absolute left-0 top-1/2 h-auto w-60 max-w-none -translate-y-1/2" />
          </div>
          <button type="button" aria-label="Close Ask Streamline" onClick={() => dialog.current?.close()}
            className="grid size-11 shrink-0 place-items-center rounded-lg text-2xl text-white transition-colors hover:bg-[#0B2A63] focus-visible:outline-2 focus-visible:outline-[#7FB6FF]">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="p-5 sm:p-7">
          <h2 id="ask-streamline-title" className="text-2xl font-bold tracking-tight">Ask Streamline</h2>
          <p className="mt-1.5 text-sm text-[#4B5D7A]">Ask for a walkthrough or look up a record.</p>
          <form onSubmit={ask} className="mt-5 space-y-3">
            <label htmlFor="ask-streamline-question" className="block text-sm font-semibold">Your question</label>
            <textarea id="ask-streamline-question" value={question} onChange={event => setQuestion(event.target.value)}
              required minLength={2} maxLength={600} rows={3} placeholder="How do I assign a booking to a driver?"
              className="w-full rounded-lg border border-[#7FB6FF] bg-white p-3 text-base placeholder:text-[#4B5D7A] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#006CFF]" />
            <button type="submit" disabled={pending || question.trim().length < 2}
              className="min-h-11 rounded-lg bg-[#006CFF] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#0B2A63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006CFF] disabled:opacity-60">
              Ask
            </button>
          </form>
          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
          <div aria-live="polite" className="space-y-3 text-sm">
            {pending && <p className="mt-4 text-[#4B5D7A]">Checking your question…</p>}
            {answer && <p className="mt-5 whitespace-pre-wrap break-words rounded-xl border border-[#D7E6FF] bg-[#F4F8FF] p-4 leading-relaxed sm:p-5">{answer}</p>}
            {links.map(link => (
              <Link key={link.href} href={link.href} onClick={() => dialog.current?.close()}
                className="inline-flex min-h-11 items-center gap-2 rounded font-semibold text-[#0B2A63] underline underline-offset-4 hover:text-[#006CFF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006CFF]">
                {link.label}<span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
