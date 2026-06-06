export default function Intro() {
  return (
    <section className="bg-gradient-to-r from-[#020B1F] via-[#071D49] to-[#031B4A] py-6 lg:py-8">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-6 lg:grid-cols-3 lg:items-center">
          <div className="flex items-center gap-4 border-white/20 lg:border-r lg:pr-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#006CFF]/50">
              <svg
                className="h-6 w-6 text-[#006CFF]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"
                />
              </svg>
            </div>

            <div>
              <h3 className="mb-1 text-sm font-bold uppercase text-[#006CFF]">
                Same Day Delivery
              </h3>

              <p className="text-sm leading-6 text-white/85">
                Fast collection and delivery across the UK when your business
                needs it most.
              </p>
            </div>
          </div>

          <div className="text-center">
            <h2 className="mb-2 text-2xl font-bold text-white lg:text-3xl">
              Same Day Courier & Logistics Services
            </h2>

            <p className="mx-auto max-w-2xl text-sm leading-6 text-white/80 lg:text-base lg:leading-7">
              Streamline Logistics Group provides dedicated business-to-business
              courier services, urgent same-day deliveries and complete
              logistics support throughout the United Kingdom.
            </p>
          </div>

          <div className="flex items-center gap-4 border-white/20 lg:border-l lg:pl-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#006CFF]/50">
              <svg
                className="h-6 w-6 text-[#006CFF]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-4z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4"
                />
              </svg>
            </div>

            <div>
              <h3 className="mb-1 text-sm font-bold uppercase text-[#006CFF]">
                Reliable & Secure
              </h3>

              <p className="text-sm leading-6 text-white/85">
                Your goods are protected by trusted drivers and fully insured
                transport services.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}