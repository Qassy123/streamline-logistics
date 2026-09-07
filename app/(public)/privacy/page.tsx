import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  FileText,
  LockKeyhole,
  Mail,
  Scale,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy | Streamline Logistics Group",
  description:
    "Read the Streamline Logistics Group privacy policy and learn how personal information may be collected, used, stored and shared.",
};

const sections = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    content: (
      <>
        <p>
          We may collect personal information when you request a quote, create
          an account, make a booking, make a payment, contact us, use delivery
          tracking or otherwise interact with Streamline Logistics Group.
        </p>

        <p className="mt-4">
          Depending on how you use our services, this may include:
        </p>

        <ul className="mt-4 list-disc space-y-2 pl-6">
          <li>Your name and contact details.</li>
          <li>Your email address and telephone number.</li>
          <li>
            Business information such as company name, trading information and
            account details.
          </li>
          <li>
            Collection, delivery, return and additional stop addresses.
          </li>
          <li>
            Contact information for people involved in collection or delivery.
          </li>
          <li>
            Booking information, delivery requirements and special
            instructions.
          </li>
          <li>Account usernames and authentication information.</li>
          <li>Payment and transaction information.</li>
          <li>Invoice and billing information.</li>
          <li>
            Driver location information where live delivery tracking is active.
          </li>
          <li>
            Proof-of-delivery information, which may include recipient names,
            signatures and delivery photographs.
          </li>
          <li>
            Information you provide when contacting us or making an enquiry.
          </li>
          <li>
            Technical information generated when you use our website or
            services.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-use-information",
    title: "2. How We Use Personal Information",
    content: (
      <>
        <p>
          We use personal information where necessary to operate Streamline
          Logistics Group and provide our courier and logistics services.
        </p>

        <p className="mt-4">This may include using information to:</p>

        <ul className="mt-4 list-disc space-y-2 pl-6">
          <li>Provide delivery quotes.</li>
          <li>Create and manage customer accounts.</li>
          <li>Process bookings and payments.</li>
          <li>Plan and carry out collections and deliveries.</li>
          <li>Assign and manage delivery jobs.</li>
          <li>Provide delivery tracking.</li>
          <li>Record proof of delivery.</li>
          <li>Create invoices and maintain transaction records.</li>
          <li>Respond to customer enquiries and provide support.</li>
          <li>Administer business and trade accounts.</li>
          <li>Maintain the security and reliability of our systems.</li>
          <li>Comply with legal, regulatory and accounting obligations.</li>
          <li>
            Prevent misuse, fraud or activity that may affect our business,
            customers or systems.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "lawful-basis",
    title: "3. Lawful Bases For Processing",
    content: (
      <>
        <p>
          Under UK data protection law, we must have a lawful basis for
          processing personal information.
        </p>

        <p className="mt-4">
          Depending on the purpose, we may rely on one or more of the following:
        </p>

        <ul className="mt-4 list-disc space-y-2 pl-6">
          <li>
            <strong>Contract:</strong> where processing is necessary to provide
            a quote, create or manage a booking, provide a delivery service,
            manage an account or take steps at your request before entering
            into a contract.
          </li>

          <li>
            <strong>Legal obligation:</strong> where we need to keep or use
            information to comply with applicable legal, tax, accounting or
            regulatory requirements.
          </li>

          <li>
            <strong>Legitimate interests:</strong> where necessary for the
            operation, administration, security and improvement of our business
            and services, provided those interests are not overridden by your
            rights and interests.
          </li>

          <li>
            <strong>Consent:</strong> where the law requires us to obtain your
            consent for a particular activity.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "sharing",
    title: "4. Who We May Share Information With",
    content: (
      <>
        <p>
          We may share personal information where reasonably necessary to
          provide our services, operate our platform or comply with legal
          requirements.
        </p>

        <p className="mt-4">This may include sharing information with:</p>

        <ul className="mt-4 list-disc space-y-2 pl-6">
          <li>Drivers involved in carrying out a delivery.</li>
          <li>Payment service providers.</li>
          <li>Email and communications service providers.</li>
          <li>Cloud hosting and database providers.</li>
          <li>File and image storage providers.</li>
          <li>Mapping, postcode and routing service providers.</li>
          <li>
            Professional advisers such as accountants, legal advisers or
            insurers where appropriate.
          </li>
          <li>
            Government bodies, regulators, law enforcement authorities or
            courts where disclosure is required or permitted by law.
          </li>
        </ul>

        <p className="mt-4">
          We do not sell personal information as part of our ordinary business
          operations.
        </p>
      </>
    ),
  },
  {
    id: "payments",
    title: "5. Payments",
    content: (
      <>
        <p>
          Online payments may be processed through third-party payment
          providers. Payment card details may be collected and processed
          directly by the payment provider rather than stored directly by
          Streamline Logistics Group.
        </p>

        <p className="mt-4">
          We may retain transaction references, payment status, invoice
          information and other records required to administer the booking and
          maintain financial records.
        </p>
      </>
    ),
  },
  {
    id: "tracking",
    title: "6. Delivery Tracking & Location Information",
    content: (
      <>
        <p>
          Where live tracking is used for an active delivery, location
          information may be collected from the assigned driver and associated
          with the relevant booking.
        </p>

        <p className="mt-4">
          This information may be used to operate the delivery, provide
          customer tracking, maintain job records and support delivery
          administration.
        </p>

        <p className="mt-4">
          Tracking access may be provided through a secure booking-specific
          tracking link or through the relevant customer account.
        </p>
      </>
    ),
  },
  {
    id: "pod",
    title: "7. Proof Of Delivery",
    content: (
      <>
        <p>
          When a delivery is completed, we may record proof-of-delivery
          information.
        </p>

        <p className="mt-4">This may include:</p>

        <ul className="mt-4 list-disc space-y-2 pl-6">
          <li>The recipient&apos;s name.</li>
          <li>A signature where provided.</li>
          <li>A delivery photograph where provided.</li>
          <li>The date and time of delivery.</li>
          <li>Information about the completion of the booking.</li>
        </ul>

        <p className="mt-4">
          This information is used to evidence delivery completion and support
          customer and operational records.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "8. How Long We Keep Information",
    content: (
      <>
        <p>
          We keep personal information only for as long as reasonably necessary
          for the purpose for which it was collected, including providing our
          services, maintaining business and financial records, resolving
          disputes and meeting legal obligations.
        </p>

        <p className="mt-4">
          Different categories of information may be kept for different
          periods. When information is no longer required, it may be deleted,
          anonymised or otherwise securely disposed of where appropriate.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "9. Security",
    content: (
      <>
        <p>
          We take reasonable technical and organisational measures designed to
          protect personal information against unauthorised access, loss,
          misuse, alteration or disclosure.
        </p>

        <p className="mt-4">
          No online service can guarantee absolute security, and customers are
          also responsible for keeping their own login details and account
          credentials secure.
        </p>
      </>
    ),
  },
  {
    id: "international",
    title: "10. International Data Transfers",
    content: (
      <>
        <p>
          Some service providers used to operate our website and services may
          process or store information outside the United Kingdom.
        </p>

        <p className="mt-4">
          Where UK data protection law requires safeguards for an international
          transfer, appropriate measures should be used by us or the relevant
          service provider to protect the transferred information.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "11. Your Data Protection Rights",
    content: (
      <>
        <p>
          Depending on the circumstances, UK data protection law may give you
          rights relating to your personal information.
        </p>

        <p className="mt-4">These may include the right to:</p>

        <ul className="mt-4 list-disc space-y-2 pl-6">
          <li>Ask for access to personal information we hold about you.</li>
          <li>Ask us to correct inaccurate or incomplete information.</li>
          <li>Ask us to delete personal information in certain circumstances.</li>
          <li>
            Ask us to restrict the use of personal information in certain
            circumstances.
          </li>
          <li>
            Object to certain processing, including some processing based on
            legitimate interests.
          </li>
          <li>
            Receive certain information in a portable format where the right to
            data portability applies.
          </li>
          <li>Withdraw consent where processing is based on consent.</li>
        </ul>

        <p className="mt-4">
          These rights are not absolute and may depend on the circumstances and
          lawful basis for processing.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "12. Cookies & Similar Technologies",
    content: (
      <>
        <p>
          Our website may use cookies or similar technologies to provide
          website functionality, maintain sessions, remember preferences,
          protect the service or understand how the website is used.
        </p>

        <p className="mt-4">
          Some cookies or similar technologies may require consent before they
          are used. Where required, appropriate information and controls should
          be provided to website users.
        </p>
      </>
    ),
  },
  {
    id: "marketing",
    title: "13. Marketing Communications",
    content: (
      <>
        <p>
          Where Streamline sends direct marketing communications, we will aim
          to do so in accordance with applicable data protection and electronic
          communications rules.
        </p>

        <p className="mt-4">
          Where consent is required, marketing should only be sent where the
          required consent has been obtained. Recipients should also be given
          an appropriate way to stop receiving marketing communications.
        </p>
      </>
    ),
  },
  {
    id: "third-party-links",
    title: "14. Third-Party Websites",
    content: (
      <p>
        Our website may contain links to third-party websites or services. We
        are not responsible for the privacy practices of external websites and
        recommend reviewing their privacy information separately.
      </p>
    ),
  },
  {
    id: "changes",
    title: "15. Changes To This Privacy Policy",
    content: (
      <>
        <p>
          We may update this Privacy Policy from time to time to reflect
          changes to our services, systems, business operations or legal
          requirements.
        </p>

        <p className="mt-4">
          The current version will be published on this page. Where appropriate,
          we may also provide additional notice of significant changes.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "16. Contact Us About Privacy",
    content: (
      <>
        <p>
          If you have a question about this Privacy Policy or how Streamline
          Logistics Group handles personal information, contact us at:
        </p>

        <div className="mt-5 rounded-2xl bg-[#F4F8FF] p-6">
          <p className="font-bold text-[#071D49]">
            Streamline Logistics Group
          </p>

          <a
            href="mailto:info@streamlinelogisticsgroup.co.uk"
            className="mt-2 block break-words font-semibold text-[#006CFF] hover:text-[#2D8CFF]"
          >
            info@streamlinelogisticsgroup.co.uk
          </a>

          <a
            href="tel:03333440703"
            className="mt-2 block font-semibold text-[#006CFF] hover:text-[#2D8CFF]"
          >
            0333 344 0703
          </a>
        </div>
      </>
    ),
  },
  {
    id: "complaints",
    title: "17. Complaints",
    content: (
      <>
        <p>
          If you have concerns about how your personal information is being
          handled, please contact us first so that we can review the issue.
        </p>

        <p className="mt-4">
          You may also have the right to raise a complaint with the UK
          Information Commissioner&apos;s Office.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
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
                <ShieldCheck size={18} className="text-[#7FB6FF]" />

                <span className="text-sm font-bold uppercase tracking-[2px] text-[#7FB6FF]">
                  Privacy & Data Protection
                </span>
              </div>

              <h1 className="text-5xl font-bold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
                Privacy Policy
              </h1>

              <p className="mt-7 max-w-3xl text-lg leading-8 text-white/85 sm:text-xl">
                This policy explains how Streamline Logistics Group may collect,
                use, store and share personal information when you use our
                website, accounts and courier services.
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
              {[
                {
                  icon: Database,
                  title: "Information",
                  text: "What information may be collected and why it is used.",
                },
                {
                  icon: LockKeyhole,
                  title: "Security",
                  text: "How personal information is protected and managed.",
                },
                {
                  icon: UserRoundCheck,
                  title: "Your Rights",
                  text: "Information about your data protection rights.",
                },
                {
                  icon: Scale,
                  title: "Legal Basis",
                  text: "The lawful grounds relied on for processing.",
                },
              ].map((item) => {
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
          <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-36 lg:self-start">
              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-6 shadow-sm">
                <p className="mb-5 text-sm font-bold uppercase tracking-[2px] text-[#006CFF]">
                  Privacy Policy
                </p>

                <nav className="space-y-2 text-sm">
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
              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-7 shadow-sm sm:p-9">
                <div className="flex items-start gap-4">
                  <FileText
                    size={28}
                    className="mt-1 shrink-0 text-[#006CFF]"
                  />

                  <div>
                    <h2 className="text-2xl font-bold text-[#071D49]">
                      About This Policy
                    </h2>

                    <p className="mt-4 leading-7 text-[#4B5D7A]">
                      This Privacy Policy applies to personal information handled
                      by Streamline Logistics Group in connection with our
                      website, customer accounts, courier bookings, delivery
                      operations, payments, tracking and related services.
                    </p>

                    <p className="mt-4 leading-7 text-[#4B5D7A]">
                      The exact information used may depend on which parts of
                      the Streamline service you use.
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
          <div className="mx-auto max-w-5xl px-6 text-center">
            <Mail size={36} className="mx-auto text-[#2D8CFF]" />

            <h2 className="mt-6 text-4xl font-bold text-white lg:text-5xl">
              Have A Privacy Question?
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/75">
              Contact Streamline Logistics Group if you have a question about
              this policy or personal information relating to your account or
              delivery.
            </p>

            <Link
              href="/contact"
              className="mt-9 inline-flex items-center justify-center gap-3 rounded-full bg-[#006CFF] px-8 py-4 font-bold text-white transition hover:-translate-y-1 hover:bg-[#2D8CFF]"
            >
              Contact Us
              <ArrowRight size={20} />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}