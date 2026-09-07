import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CircleCheck,
  FileText,
  Package,
  Route,
  Scale,
  ShieldCheck,
  Truck,
  UserCheck,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Terms & Conditions | Streamline Logistics Group",
  description:
    "Read the terms and conditions governing quotes, bookings, payments, collections and courier services provided by Streamline Logistics Group.",
};

const sections = [
  {
    id: "about-these-terms",
    title: "1. About These Terms",
    content: (
      <>
        <p>
          These Terms & Conditions apply when you use the Streamline Logistics
          Group website, request a quote, create an account, make a booking or
          use our courier and logistics services.
        </p>

        <p className="mt-4">
          By placing a booking, you confirm that you have authority to enter
          into the booking and that the information you provide is accurate to
          the best of your knowledge.
        </p>

        <p className="mt-4">
          If you are arranging a delivery on behalf of a company,
          organisation or another person, you confirm that you are authorised
          to do so.
        </p>
      </>
    ),
  },
  {
    id: "services",
    title: "2. Our Services",
    content: (
      <>
        <p>
          Streamline Logistics Group provides courier and logistics services
          for business collections and deliveries within the areas we support.
        </p>

        <p className="mt-4">
          Depending on availability and the booking requirements, services may
          include:
        </p>

        <ul className="mt-4 list-disc space-y-2 pl-6">
          <li>Same-day courier services.</li>
          <li>Next-day delivery services.</li>
          <li>One-way journeys.</li>
          <li>Return journeys.</li>
          <li>Multi-drop journeys.</li>
          <li>Dedicated vehicle transport.</li>
          <li>Delivery tracking where available.</li>
          <li>Proof of delivery.</li>
        </ul>

        <p className="mt-4">
          The service provided for a particular booking will be based on the
          details confirmed during the quote and booking process.
        </p>
      </>
    ),
  },
  {
    id: "quotes",
    title: "3. Quotes",
    content: (
      <>
        <p>
          Quotes are calculated using the information entered during the quote
          process, which may include route information, journey type, distance,
          vehicle requirements, timing and additional stops.
        </p>

        <p className="mt-4">
          A quote is based on the information available at the time it is
          generated and does not create a confirmed booking until the required
          booking and payment steps have been completed.
        </p>

        <p className="mt-4">
          If the booking information changes materially after a quote has been
          produced, including changes to addresses, stops, vehicle
          requirements, load requirements or journey details, the price or
          availability may need to be recalculated.
        </p>
      </>
    ),
  },
  {
    id: "booking",
    title: "4. Booking Confirmation",
    content: (
      <>
        <p>
          A booking is confirmed when the required booking process has been
          completed and Streamline has accepted the booking.
        </p>

        <p className="mt-4">
          Where payment is required before the booking can proceed, the booking
          may remain pending until payment has been successfully completed.
        </p>

        <p className="mt-4">
          Booking confirmations and related information may be provided
          electronically, including by email or through the Streamline customer
          account.
        </p>
      </>
    ),
  },
  {
    id: "customer-information",
    title: "5. Your Responsibilities",
    content: (
      <>
        <p>
          You are responsible for providing complete and accurate information
          when requesting a quote or making a booking.
        </p>

        <p className="mt-4">You should ensure that:</p>

        <ul className="mt-4 list-disc space-y-2 pl-6">
          <li>
            Collection, delivery, return and additional stop addresses are
            correct.
          </li>
          <li>Relevant contact information is accurate.</li>
          <li>
            Collection and delivery access requirements are communicated where
            relevant.
          </li>
          <li>
            The description, quantity, size and nature of the goods are
            accurately represented.
          </li>
          <li>
            Relevant special instructions are provided before the journey
            begins.
          </li>
          <li>
            The selected vehicle is suitable for the load based on the
            information available to you.
          </li>
          <li>
            Goods are appropriately prepared, packaged and secured for
            transport where this is your responsibility.
          </li>
        </ul>

        <p className="mt-4">
          You may be responsible for reasonable additional costs arising from
          materially inaccurate or incomplete booking information where those
          costs could not reasonably have been anticipated from the original
          booking.
        </p>
      </>
    ),
  },
  {
    id: "goods",
    title: "6. Goods We Carry",
    content: (
      <>
        <p>
          Goods must be lawful to transport and suitable for the service and
          vehicle booked.
        </p>

        <p className="mt-4">
          You must tell us before booking if goods have unusual handling,
          security, regulatory, temperature, packaging or transport
          requirements.
        </p>

        <p className="mt-4">
          Certain goods may require specialist arrangements or may not be
          suitable for our standard courier service. We may refuse a booking
          where we reasonably believe the goods cannot lawfully or safely be
          transported using the service requested.
        </p>
      </>
    ),
  },
  {
    id: "prohibited-items",
    title: "7. Restricted & Prohibited Items",
    content: (
      <>
        <p>
          You must not knowingly ask us to transport goods where doing so would
          be unlawful or would require specialist permissions, licences,
          handling or transport arrangements that have not been agreed in
          advance.
        </p>

        <p className="mt-4">
          This may include dangerous, hazardous, controlled, illegal,
          restricted or otherwise specially regulated goods.
        </p>

        <p className="mt-4">
          If you are unsure whether an item is suitable for transport, contact
          us before placing the booking.
        </p>
      </>
    ),
  },
  {
    id: "collection",
    title: "8. Collection",
    content: (
      <>
        <p>
          You must ensure that the goods are ready for collection at the
          agreed location and that the driver can reasonably access the
          collection point.
        </p>

        <p className="mt-4">
          A suitable person should be available where necessary to hand over
          the goods and provide any relevant collection information.
        </p>

        <p className="mt-4">
          Collection and delivery times may be expressed as estimated times or
          time windows unless a specific commitment has expressly been agreed.
        </p>
      </>
    ),
  },
  {
    id: "delivery",
    title: "9. Delivery",
    content: (
      <>
        <p>
          We will aim to complete the delivery in accordance with the booking
          information and the service selected.
        </p>

        <p className="mt-4">
          Delivery may require an appropriate person to be available to receive
          the goods.
        </p>

        <p className="mt-4">
          Where a delivery cannot reasonably be completed because of incorrect
          information, lack of access, an unavailable recipient or another
          circumstance outside our reasonable control, we may contact the
          booking customer for further instructions.
        </p>

        <p className="mt-4">
          Additional journey, waiting, redelivery or return requirements may
          result in additional charges where applicable and where those charges
          are permitted by law and reasonably incurred.
        </p>
      </>
    ),
  },
  {
    id: "multi-drop",
    title: "10. Multi-Drop & Return Journeys",
    content: (
      <>
        <p>
          Where a booking includes multiple stops or a return journey, you are
          responsible for ensuring that each address and relevant stop
          instruction is accurate.
        </p>

        <p className="mt-4">
          Route order, journey distance and timing may affect the price and
          estimated duration of the booking.
        </p>

        <p className="mt-4">
          Changes to the route after the booking has been confirmed may require
          a revised price or additional charge.
        </p>
      </>
    ),
  },
  {
    id: "payments",
    title: "11. Prices & Payments",
    content: (
      <>
        <p>
          The price payable for a booking will be shown or otherwise confirmed
          during the booking process.
        </p>

        <p className="mt-4">
          Where applicable, VAT and other relevant charges will be identified
          as part of the price information provided.
        </p>

        <p className="mt-4">
          Online card payments may be processed through a third-party payment
          provider.
        </p>

        <p className="mt-4">
          Unless another payment arrangement has been expressly agreed, payment
          must be completed when required before the booking can proceed.
        </p>
      </>
    ),
  },
  {
    id: "trade-accounts",
    title: "12. Business & Trade Accounts",
    content: (
      <>
        <p>
          Business customers may create an account to access additional
          booking and account-management features.
        </p>

        <p className="mt-4">
          Trade account facilities are subject to application, review and
          approval. Creating or submitting an application does not guarantee
          approval.
        </p>

        <p className="mt-4">
          Any agreed credit terms, credit limits or payment arrangements for a
          trade account may be subject to separate conditions communicated to
          the account holder.
        </p>

        <p className="mt-4">
          We may review, suspend or withdraw trade account facilities where
          reasonably necessary, including where payments become overdue or
          account information is materially inaccurate.
        </p>
      </>
    ),
  },
  {
    id: "cancellations",
    title: "13. Cancellations & Changes",
    content: (
      <>
        <p>
          If you need to cancel or change a booking, you should contact us as
          soon as possible.
        </p>

        <p className="mt-4">
          Whether a cancellation or amendment is possible, and whether any
          reasonable charge applies, may depend on the stage the booking has
          reached, including whether a vehicle or driver has already been
          allocated or dispatched.
        </p>

        <p className="mt-4">
          Where you are legally entitled to cancellation rights that cannot be
          excluded or restricted by these Terms, those statutory rights will
          continue to apply.
        </p>
      </>
    ),
  },
  {
    id: "delays",
    title: "14. Delays & Events Outside Our Control",
    content: (
      <>
        <p>
          Courier journeys may be affected by circumstances outside our
          reasonable control.
        </p>

        <p className="mt-4">These may include:</p>

        <ul className="mt-4 list-disc space-y-2 pl-6">
          <li>Traffic congestion or road closures.</li>
          <li>Severe weather.</li>
          <li>Accidents or vehicle breakdowns.</li>
          <li>Emergency incidents.</li>
          <li>Incorrect or inaccessible addresses.</li>
          <li>Delays caused by collection or delivery locations.</li>
          <li>Acts or restrictions imposed by public authorities.</li>
          <li>Other circumstances we could not reasonably prevent.</li>
        </ul>

        <p className="mt-4">
          Where disruption occurs, we will aim to manage the booking reasonably
          and provide relevant information where practicable.
        </p>
      </>
    ),
  },
  {
    id: "tracking",
    title: "15. Tracking",
    content: (
      <>
        <p>
          Where delivery tracking is available, tracking information is
          provided to assist customers in following the progress of an active
          booking.
        </p>

        <p className="mt-4">
          Tracking information may be dependent on location data received from
          the assigned driver, device connectivity and the availability of the
          relevant systems.
        </p>

        <p className="mt-4">
          Tracking should therefore be treated as operational information and
          not as a guarantee of an exact arrival time.
        </p>
      </>
    ),
  },
  {
    id: "proof-of-delivery",
    title: "16. Proof Of Delivery",
    content: (
      <>
        <p>
          A completed booking may include proof-of-delivery information such as
          the recipient name, delivery time, signature or photograph where
          available.
        </p>

        <p className="mt-4">
          Proof-of-delivery information forms part of the operational record of
          the booking.
        </p>
      </>
    ),
  },
  {
    id: "accounts-security",
    title: "17. Account Security",
    content: (
      <>
        <p>
          You are responsible for taking reasonable steps to keep your account
          credentials secure and for activities carried out through your
          account by authorised users.
        </p>

        <p className="mt-4">
          You should contact us promptly if you believe your account has been
          accessed without permission.
        </p>

        <p className="mt-4">
          We may restrict or suspend access to an account where reasonably
          necessary to protect the customer, our systems or other users.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "18. Liability",
    content: (
      <>
        <p>
          Nothing in these Terms excludes or limits liability where doing so
          would be unlawful.
        </p>

        <p className="mt-4">
          In particular, nothing in these Terms is intended to exclude or
          restrict liability for death or personal injury caused by negligence,
          fraud, fraudulent misrepresentation, or any other liability that
          cannot lawfully be excluded or restricted.
        </p>

        <p className="mt-4">
          Any other limitation or exclusion of liability will apply only to the
          extent permitted by law and will depend on the circumstances of the
          relevant booking.
        </p>

        <p className="mt-4">
          Customers should ensure that goods requiring particular insurance,
          declared-value protection or specialist carriage arrangements are
          identified before booking rather than assuming that a particular
          level of cover automatically applies.
        </p>
      </>
    ),
  },
  {
    id: "claims",
    title: "19. Problems, Loss Or Damage",
    content: (
      <>
        <p>
          If you believe goods have been lost, damaged or delivered
          incorrectly, contact us as soon as reasonably possible with the
          relevant booking information.
        </p>

        <p className="mt-4">
          We may ask for supporting information reasonably required to
          investigate the issue, including booking details, photographs,
          invoices, proof of value or other relevant evidence.
        </p>

        <p className="mt-4">
          Any claim will be considered according to the facts of the booking,
          these Terms, any separately agreed carriage conditions and applicable
          law.
        </p>
      </>
    ),
  },
  {
    id: "website",
    title: "20. Website Availability",
    content: (
      <>
        <p>
          We aim to keep the Streamline website and online services available
          and operating correctly, but uninterrupted availability cannot be
          guaranteed.
        </p>

        <p className="mt-4">
          Access may occasionally be restricted because of maintenance,
          technical problems, security concerns or circumstances outside our
          reasonable control.
        </p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    title: "21. Website Content & Intellectual Property",
    content: (
      <>
        <p>
          Unless otherwise stated, the content, branding, layout and materials
          made available through the Streamline website belong to Streamline
          Logistics Group or are used with appropriate permission.
        </p>

        <p className="mt-4">
          You may use the website for legitimate personal or business purposes
          connected with accessing our services, but you must not copy,
          reproduce or exploit protected website content unlawfully.
        </p>
      </>
    ),
  },
  {
    id: "privacy",
    title: "22. Privacy",
    content: (
      <>
        <p>
          Personal information is handled in accordance with our Privacy
          Policy and applicable data protection requirements.
        </p>

        <p className="mt-4">
          The Privacy Policy explains the types of information we may process
          in connection with quotes, accounts, bookings, payments, tracking and
          proof of delivery.
        </p>

        <Link
          href="/privacy"
          className="mt-5 inline-flex items-center gap-2 font-bold text-[#006CFF] transition hover:text-[#2D8CFF]"
        >
          Read Our Privacy Policy
          <ArrowRight size={18} />
        </Link>
      </>
    ),
  },
  {
    id: "termination",
    title: "23. Suspension Or Termination",
    content: (
      <>
        <p>
          We may suspend or terminate access to an account or refuse a booking
          where reasonably necessary, including where there is suspected fraud,
          misuse of the service, unlawful activity, serious or repeated breach
          of these Terms, security concerns or unpaid sums.
        </p>

        <p className="mt-4">
          Any action taken under this section will remain subject to applicable
          law and any rights that cannot legally be excluded.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "24. Third-Party Services",
    content: (
      <>
        <p>
          Certain parts of our service may rely on third-party providers,
          including payment processing, hosting, mapping, communications and
          file-storage services.
        </p>

        <p className="mt-4">
          Where you interact directly with a third-party service, separate
          terms or privacy information from that provider may also apply.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "25. Changes To These Terms",
    content: (
      <>
        <p>
          We may update these Terms from time to time to reflect changes to our
          services, systems, operating procedures or legal requirements.
        </p>

        <p className="mt-4">
          The version published on this page will be the current website
          version. Changes will not remove rights that cannot lawfully be
          excluded.
        </p>
      </>
    ),
  },
  {
    id: "law",
    title: "26. Governing Law & Jurisdiction",
    content: (
      <>
        <p>
          These Terms and any dispute arising from them will be governed by the
          laws applicable to the contractual relationship.
        </p>

        <p className="mt-4">
          Where the customer is acting wholly in the course of business, the
          parties may agree that the courts of England and Wales will have
          jurisdiction, subject to any mandatory legal rules that apply.
        </p>

        <p className="mt-4">
          Nothing in this section is intended to remove any mandatory rights or
          jurisdiction protections available to a customer under applicable
          law.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "27. Contact",
    content: (
      <>
        <p>
          If you have a question about these Terms or a Streamline booking,
          contact us using the details below.
        </p>

        <div className="mt-5 rounded-2xl bg-[#F4F8FF] p-6">
          <p className="font-bold text-[#071D49]">
            Streamline Logistics Group
          </p>

          <a
            href="mailto:info@streamlinelogisticsgroup.co.uk"
            className="mt-2 block break-words font-semibold text-[#006CFF] transition hover:text-[#2D8CFF]"
          >
            info@streamlinelogisticsgroup.co.uk
          </a>

          <a
            href="tel:03333440703"
            className="mt-2 block font-semibold text-[#006CFF] transition hover:text-[#2D8CFF]"
          >
            0333 344 0703
          </a>
        </div>
      </>
    ),
  },
];

const overviewItems = [
  {
    icon: FileText,
    title: "Quotes & Bookings",
    text: "How quotes are calculated and when a booking becomes confirmed.",
  },
  {
    icon: Package,
    title: "Your Goods",
    text: "Your responsibilities when describing and preparing goods for transport.",
  },
  {
    icon: Banknote,
    title: "Prices & Payment",
    text: "How booking prices, payments and account arrangements operate.",
  },
  {
    icon: ShieldCheck,
    title: "Responsibilities",
    text: "Important information about liability, claims and customer responsibilities.",
  },
];

export default function TermsPage() {
  return (
    <>
      <Header />

      <main>
        <section className="relative overflow-hidden bg-[#071D49] py-24 lg:py-32">
          <div className="absolute -right-32 -top-32 h-[460px] w-[460px] rounded-full bg-[#006CFF]/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-[#2D8CFF]/10 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-6">
            <div className="max-w-4xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2D8CFF]/40 bg-[#006CFF]/10 px-4 py-2">
                <Scale size={18} className="text-[#7FB6FF]" />

                <span className="text-sm font-bold uppercase tracking-[2px] text-[#7FB6FF]">
                  Service Terms
                </span>
              </div>

              <h1 className="text-5xl font-bold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
                Terms & Conditions
              </h1>

              <p className="mt-7 max-w-3xl text-lg leading-8 text-white/85 sm:text-xl">
                These Terms explain the conditions that apply when using
                Streamline Logistics Group, requesting a quote and arranging
                courier and delivery services.
              </p>

              <p className="mt-6 text-sm font-medium text-white/60">
                Last reviewed: September 2026
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {overviewItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-7"
                  >
                    <Icon size={28} className="mb-5 text-[#006CFF]" />

                    <h2 className="text-xl font-bold text-[#071D49]">
                      {item.title}
                    </h2>

                    <p className="mt-3 leading-7 text-[#4B5D7A]">
                      {item.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FF] py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-36 lg:self-start">
              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-6 shadow-sm">
                <p className="mb-5 text-sm font-bold uppercase tracking-[2px] text-[#006CFF]">
                  Terms & Conditions
                </p>

                <nav className="max-h-[70vh] space-y-2 overflow-y-auto pr-1 text-sm">
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="block rounded-xl px-3 py-2 font-medium text-[#4B5D7A] transition hover:bg-[#EAF2FF] hover:text-[#006CFF]"
                    >
                      {section.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="space-y-6">
              <div className="rounded-3xl border border-[#F4CF85] bg-[#FFF8E8] p-7 sm:p-9">
                <div className="flex items-start gap-4">
                  <AlertTriangle
                    size={28}
                    className="mt-1 shrink-0 text-[#A66A00]"
                  />

                  <div>
                    <h2 className="text-2xl font-bold text-[#071D49]">
                      Please Read These Terms Before Booking
                    </h2>

                    <p className="mt-4 leading-7 text-[#4B5D7A]">
                      These Terms contain important information about booking
                      requirements, payments, goods, cancellations,
                      responsibilities and the operation of our courier
                      services.
                    </p>
                  </div>
                </div>
              </div>

              {sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-36 rounded-3xl border border-[#D7E6FF] bg-white p-7 shadow-sm sm:p-9"
                >
                  <h2 className="text-2xl font-bold text-[#071D49] sm:text-3xl">
                    {section.title}
                  </h2>

                  <div className="mt-5 leading-7 text-[#4B5D7A]">
                    {section.content}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#071D49] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-3xl border border-[#1F4D94] bg-[#0B2A63] p-8">
                <CircleCheck size={30} className="mb-5 text-[#2D8CFF]" />

                <h3 className="text-xl font-bold text-white">
                  Check Your Details
                </h3>

                <p className="mt-3 leading-7 text-white/75">
                  Make sure addresses, contacts, load information and journey
                  requirements are accurate before confirming a booking.
                </p>
              </div>

              <div className="rounded-3xl border border-[#1F4D94] bg-[#0B2A63] p-8">
                <Truck size={30} className="mb-5 text-[#2D8CFF]" />

                <h3 className="text-xl font-bold text-white">
                  Choose A Suitable Vehicle
                </h3>

                <p className="mt-3 leading-7 text-white/75">
                  Vehicle selection should reflect the load information and
                  transport requirements provided during the quote.
                </p>
              </div>

              <div className="rounded-3xl border border-[#1F4D94] bg-[#0B2A63] p-8">
                <Route size={30} className="mb-5 text-[#2D8CFF]" />

                <h3 className="text-xl font-bold text-white">
                  Tell Us About Changes
                </h3>

                <p className="mt-3 leading-7 text-white/75">
                  Material changes to a confirmed journey should be raised as
                  soon as possible so they can be reviewed.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-5xl px-6">
            <div className="rounded-[2rem] border border-[#D7E6FF] bg-[#F4F8FF] p-8 text-center sm:p-12">
              <UserCheck size={36} className="mx-auto text-[#006CFF]" />

              <h2 className="mt-6 text-4xl font-bold text-[#071D49] lg:text-5xl">
                Have A Question About A Booking?
              </h2>

              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#4B5D7A]">
                Contact Streamline Logistics Group if you need clarification
                about a booking, service requirement or these Terms &
                Conditions.
              </p>

              <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-[#006CFF] px-8 py-4 font-bold text-white transition hover:-translate-y-1 hover:bg-[#2D8CFF]"
                >
                  Contact Us
                  <ArrowRight size={20} />
                </Link>

                <Link
                  href="/quote"
                  className="inline-flex items-center justify-center rounded-full border border-[#D7E6FF] bg-white px-8 py-4 font-bold text-[#071D49] transition hover:border-[#006CFF]"
                >
                  Get An Instant Quote
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}