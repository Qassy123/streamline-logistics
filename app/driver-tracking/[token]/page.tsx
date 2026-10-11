import Link from "next/link";
export const metadata = { robots: { index: false, follow: false } };
export default function RetiredDriverTracking() { return <main className="mx-auto max-w-lg space-y-4 p-6"><h1 className="text-2xl font-bold">Driver tracking has moved</h1><p>Sign in to the driver portal, accept your assigned job and start its journey. Enable phone sharing from the job when safely parked.</p><Link className="inline-flex min-h-12 items-center rounded-xl bg-blue-600 px-5 text-white" href="/driver/login">Open driver portal</Link></main>; }
