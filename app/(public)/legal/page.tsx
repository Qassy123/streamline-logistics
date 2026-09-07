import type { Metadata } from "next";
import Link from "next/link";
import {
  Accessibility,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleHelp,
  Cookie,
  Database,
  FileCheck2,
  FileText,
  Gavel,
  Globe2,
  HardHat,
  Landmark,
  LockKeyhole,
  Mail,
  Package,
  ReceiptText,
  Scale,
  ShieldCheck,
  Truck,
  UserRoundCheck,
  Users,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Legal & Compliance | Streamline Logistics Group",
  description:
    "Legal and compliance information for Streamline Logistics Group, including data protection, consumer law, e-commerce, transport, safety and business compliance.",
};

type LegalItem = {
  name: string;
  status: "Core" | "Conditional";
  description: string;
};

type LegalSection = {
  id: string;
  title: string;
  description: string;
  icon: typeof Scale;
  laws: LegalItem[];
};

const legalSections: LegalSection[] = [
  {
    id: "data-protection",
    title: "Data Protection & Privacy",
    description:
      "Rules governing personal information handled through quotes, accounts, bookings, payments, tracking and proof of delivery.",
    icon: Database,
    laws: [
      {
        name: "UK General Data Protection Regulation (UK GDPR)",
        status: "Core",
        description:
          "Sets the principal rules for lawful, fair and transparent processing of personal data, including lawful bases, individual rights, security, accountability and international transfers.",
      },
      {
        name: "Data Protection Act 2018",
        status: "Core",
        description:
          "Supplements the UK GDPR and contains additional UK data protection provisions, exemptions, enforcement rules and requirements.",
      },
      {
        name: "Data (Use and Access) Act 2025",
        status: "Core",
        description:
          "Amends parts of the United Kingdom data protection and digital information framework and must be considered alongside the UK GDPR and Data Protection Act 2018.",
      },
      {
        name: "Privacy and Electronic Communications Regulations 2003 (PECR)",
        status: "Core",
        description:
          "Relevant to cookies, similar storage technologies and certain electronic marketing communications.",
      },
    ],
  },
  {
    id: "online-services",
    title: "Website, Online Booking & E-Commerce",
    description:
      "Rules relevant to operating an online quote, account, booking and payment platform.",
    icon: Globe2,
    laws: [
      {
        name: "Electronic Commerce (EC Directive) Regulations 2002",
        status: "Core",
        description:
          "Requires certain information to be made available by online service providers and contains rules relating to electronic contracting.",
      },
      {
        name: "Companies Act 2006",
        status: "Core",
        description:
          "Contains core company-law obligations relevant to incorporated businesses, records and company disclosures.",
      },
      {
        name: "Companies (Trading Disclosures) Regulations 2008",
        status: "Core",
        description:
          "Requires applicable companies to disclose prescribed company information on websites and certain business documents.",
      },
      {
        name: "Digital Markets, Competition and Consumers Act 2024",
        status: "Conditional",
        description:
          "Its consumer-protection provisions regulate unfair commercial practices including misleading actions, misleading omissions, aggressive practices, drip pricing and other prohibited practices where Streamline deals with consumers.",
      },
    ],
  },
  {
    id: "consumer-law",
    title: "Consumer Protection",
    description:
      "These requirements become particularly important whenever a customer is legally acting as a consumer rather than wholly for business purposes.",
    icon: ShieldCheck,
    laws: [
      {
        name: "Consumer Rights Act 2015",
        status: "Conditional",
        description:
          "Requires consumer services to be performed with reasonable care and skill and controls unfair or non-transparent consumer contract terms and notices.",
      },
      {
        name: "Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013",
        status: "Conditional",
        description:
          "Contains pre-contract information, confirmation and cancellation requirements for qualifying distance and off-premises consumer contracts.",
      },
      {
        name: "Digital Markets, Competition and Consumers Act 2024 — Unfair Commercial Practices",
        status: "Conditional",
        description:
          "The current unfair-commercial-practices regime applies to business-to-consumer commercial practices and replaced the former Consumer Protection from Unfair Trading Regulations regime for practices from 6 April 2025.",
      },
    ],
  },
  {
    id: "contracts",
    title: "Contracts & Business Customers",
    description:
      "Rules relevant to agreements between Streamline and its commercial customers.",
    icon: FileText,
    laws: [
      {
        name: "Supply of Goods and Services Act 1982",
        status: "Conditional",
        description:
          "May imply terms into qualifying business service contracts, subject to the contract and other applicable legislation.",
      },
      {
        name: "Unfair Contract Terms Act 1977",
        status: "Conditional",
        description:
          "Restricts certain exclusions and limitations of liability, particularly in business contracts, and applies statutory reasonableness tests in relevant circumstances.",
      },
      {
        name: "Late Payment of Commercial Debts (Interest) Act 1998",
        status: "Conditional",
        description:
          "Provides statutory remedies for qualifying late payments between businesses, including statutory interest where the regime applies.",
      },
      {
        name: "Late Payment of Commercial Debts Regulations",
        status: "Conditional",
        description:
          "Supplement the statutory late-payment framework, including qualifying recovery costs and payment rules.",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments, VAT & Financial Records",
    description:
      "Requirements relating to collecting payment, invoicing and maintaining business records.",
    icon: ReceiptText,
    laws: [
      {
        name: "Value Added Tax Act 1994",
        status: "Conditional",
        description:
          "Applies where Streamline is required or registered to account for VAT, including applicable VAT treatment and records.",
      },
      {
        name: "VAT Regulations 1995",
        status: "Conditional",
        description:
          "Contain detailed VAT administration, invoicing and record-keeping rules relevant to VAT-registered businesses.",
      },
      {
        name: "Companies Act 2006 Accounting & Record Requirements",
        status: "Core",
        description:
          "Requires qualifying companies to maintain appropriate accounting records and comply with statutory company reporting obligations.",
      },
      {
        name: "Consumer Credit Act 1974",
        status: "Conditional",
        description:
          "May become relevant if regulated credit is offered to individuals, sole traders or certain other customers. Ordinary qualifying business-to-business trade credit must be assessed separately before assuming this regime applies.",
      },
    ],
  },
  {
    id: "road-transport",
    title: "Road Transport & Fleet Compliance",
    description:
      "Operational rules depend heavily on the type, weight, use and destination of each vehicle.",
    icon: Truck,
    laws: [
      {
        name: "Road Traffic Act 1988",
        status: "Core",
        description:
          "Contains fundamental road-traffic requirements including driving, vehicle use, roadworthiness and compulsory motor-insurance provisions.",
      },
      {
        name: "Road Vehicles (Construction and Use) Regulations 1986",
        status: "Core",
        description:
          "Set construction, equipment, maintenance, loading and use requirements for vehicles operated on public roads.",
      },
      {
        name: "Road Vehicles Lighting Regulations 1989",
        status: "Core",
        description:
          "Set legal requirements for vehicle lighting and reflectors.",
      },
      {
        name: "Vehicle Excise and Registration Act 1994",
        status: "Core",
        description:
          "Governs vehicle registration and vehicle excise obligations.",
      },
      {
        name: "Goods Vehicles (Licensing of Operators) Act 1995",
        status: "Conditional",
        description:
          "Operator-licensing requirements may apply depending on vehicle weight, vehicle combinations, whether goods are carried for hire or reward and where vehicles operate.",
      },
      {
        name: "Transport Act 1968 — GB Domestic Drivers' Hours",
        status: "Conditional",
        description:
          "GB domestic drivers' hours rules apply to many commercial goods-vehicle operations that are outside the assimilated drivers' hours regime.",
      },
      {
        name: "Assimilated Regulation (EC) No 561/2006",
        status: "Conditional",
        description:
          "Drivers' hours requirements apply to qualifying goods vehicles and certain qualifying international light-goods-vehicle operations.",
      },
      {
        name: "Assimilated Regulation (EU) No 165/2014",
        status: "Conditional",
        description:
          "Contains tachograph requirements where the relevant regulated drivers' hours regime applies.",
      },
      {
        name: "Road Transport (Working Time) Regulations 2005",
        status: "Conditional",
        description:
          "Working-time requirements apply to qualifying mobile workers operating under the relevant road-transport regime.",
      },
    ],
  },
  {
    id: "vehicle-licensing",
    title: "Drivers, Vehicles & Insurance",
    description:
      "Every vehicle and driver used for Streamline operations must meet the requirements applicable to that vehicle and journey.",
    icon: FileCheck2,
    laws: [
      {
        name: "Motor Vehicles (Driving Licences) Regulations 1999",
        status: "Core",
        description:
          "Drivers must hold an appropriate and valid driving entitlement for the vehicle they operate.",
      },
      {
        name: "Road Traffic Act 1988 — Compulsory Motor Insurance",
        status: "Core",
        description:
          "Motor vehicles used on public roads must have legally sufficient motor insurance.",
      },
      {
        name: "Road Traffic (New Drivers) Act 1995",
        status: "Conditional",
        description:
          "Contains additional licence consequences for qualifying newly qualified drivers.",
      },
      {
        name: "Goods Vehicle Testing Legislation",
        status: "Conditional",
        description:
          "Additional testing and roadworthiness requirements apply to vehicles falling within the relevant goods-vehicle testing regime.",
      },
    ],
  },
  {
    id: "health-safety",
    title: "Health & Safety",
    description:
      "Relevant where Streamline employs workers, operates vehicles, handles loads or controls a workplace.",
    icon: HardHat,
    laws: [
      {
        name: "Health and Safety at Work etc. Act 1974",
        status: "Core",
        description:
          "Creates fundamental duties relating to the health, safety and welfare of employees and others affected by business activities.",
      },
      {
        name: "Management of Health and Safety at Work Regulations 1999",
        status: "Core",
        description:
          "Require suitable management of workplace risks, including risk assessment and preventive arrangements.",
      },
      {
        name: "Manual Handling Operations Regulations 1992",
        status: "Core",
        description:
          "Require employers to avoid hazardous manual handling where reasonably practicable, assess unavoidable handling and reduce the risk of injury.",
      },
      {
        name: "Provision and Use of Work Equipment Regulations 1998 (PUWER)",
        status: "Conditional",
        description:
          "Applies to relevant work equipment and requires it to be suitable, maintained and used safely.",
      },
      {
        name: "Personal Protective Equipment at Work Regulations",
        status: "Conditional",
        description:
          "Require appropriate PPE to be provided and managed where workplace risks make it necessary.",
      },
      {
        name: "Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013 (RIDDOR)",
        status: "Conditional",
        description:
          "Requires specified workplace injuries, diseases and dangerous occurrences to be reported where the statutory criteria are met.",
      },
      {
        name: "Workplace (Health, Safety and Welfare) Regulations 1992",
        status: "Conditional",
        description:
          "Set minimum health, safety and welfare standards for qualifying workplaces.",
      },
    ],
  },
  {
    id: "employment",
    title: "Employment & Workforce",
    description:
      "Relevant whenever Streamline engages employees or workers and may differ according to employment status.",
    icon: Users,
    laws: [
      {
        name: "Employment Rights Act 1996",
        status: "Conditional",
        description:
          "Contains major statutory employment rights including written particulars and protections relating to employment.",
      },
      {
        name: "Working Time Regulations 1998",
        status: "Conditional",
        description:
          "Govern working time, rest and paid annual leave for workers subject to the regime, alongside specialist road-transport working-time rules where applicable.",
      },
      {
        name: "National Minimum Wage Act 1998",
        status: "Conditional",
        description:
          "Requires qualifying workers to be paid at least the applicable statutory minimum rate.",
      },
      {
        name: "Equality Act 2010",
        status: "Core",
        description:
          "Prohibits unlawful discrimination and creates relevant duties in employment and in the provision of services in Great Britain.",
      },
      {
        name: "Pensions Act 2008",
        status: "Conditional",
        description:
          "Creates workplace pension automatic-enrolment duties for qualifying employers and workers.",
      },
      {
        name: "Employers' Liability (Compulsory Insurance) Act 1969",
        status: "Conditional",
        description:
          "Requires most employers in Great Britain to maintain qualifying employers' liability insurance.",
      },
    ],
  },
  {
    id: "accessibility",
    title: "Equality & Accessibility",
    description:
      "The Streamline website and customer service must not unlawfully disadvantage disabled users.",
    icon: Accessibility,
    laws: [
      {
        name: "Equality Act 2010",
        status: "Core",
        description:
          "Service providers in Great Britain must avoid unlawful discrimination and may be required to make reasonable adjustments for disabled people, including adjustments relevant to digital services.",
      },
      {
        name: "Disability Discrimination Act 1995 — Northern Ireland",
        status: "Conditional",
        description:
          "Different anti-discrimination legislation applies in Northern Ireland and must be considered where Streamline provides services there.",
      },
    ],
  },
  {
    id: "anti-bribery",
    title: "Business Conduct, Fraud & Bribery",
    description:
      "General business-integrity legislation relevant to commercial operations and staff.",
    icon: Gavel,
    laws: [
      {
        name: "Bribery Act 2010",
        status: "Core",
        description:
          "Creates offences concerning offering, giving, requesting and receiving bribes and includes a corporate offence relating to failure to prevent bribery.",
      },
      {
        name: "Fraud Act 2006",
        status: "Core",
        description:
          "Creates offences including fraud by false representation, failure to disclose information where legally required and abuse of position.",
      },
      {
        name: "Economic Crime and Corporate Transparency Act 2023",
        status: "Conditional",
        description:
          "Contains corporate transparency and economic-crime measures, including provisions that may affect companies depending on their size and circumstances.",
      },
      {
        name: "Modern Slavery Act 2015",
        status: "Conditional",
        description:
          "Modern-slavery offences apply generally, while the statutory annual transparency statement requirement applies to qualifying commercial organisations meeting the turnover and other statutory tests.",
      },
    ],
  },
  {
    id: "specialist-goods",
    title: "Dangerous, Controlled & Specialist Goods",
    description:
      "These laws do not mean Streamline currently accepts these goods. They identify regimes that must be assessed before any specialist carriage is offered.",
    icon: AlertTriangle,
    laws: [
      {
        name: "Carriage of Dangerous Goods and Use of Transportable Pressure Equipment Regulations 2009",
        status: "Conditional",
        description:
          "Applies where dangerous goods within the statutory regime are carried by road and imposes specialist classification, packaging, documentation, vehicle, training and safety requirements.",
      },
      {
        name: "ADR — Agreement Concerning the International Carriage of Dangerous Goods by Road",
        status: "Conditional",
        description:
          "Relevant to qualifying dangerous-goods road transport and incorporated into the UK dangerous-goods framework where applicable.",
      },
      {
        name: "Human Medicines Regulations 2012",
        status: "Conditional",
        description:
          "May become relevant where operations involve medicinal products subject to pharmaceutical regulation.",
      },
      {
        name: "Misuse of Drugs Act 1971 and Misuse of Drugs Regulations 2001",
        status: "Conditional",
        description:
          "Create strict legal controls around controlled drugs. Standard courier acceptance must not be assumed to authorise their carriage.",
      },
      {
        name: "Food Safety Act 1990",
        status: "Conditional",
        description:
          "May become relevant where Streamline undertakes transport forming part of a regulated food supply chain.",
      },
      {
        name: "Food Hygiene Legislation",
        status: "Conditional",
        description:
          "Additional hygiene and transport controls may apply where food is carried and must be assessed for the particular food and service.",
      },
    ],
  },
  {
    id: "waste-environment",
    title: "Waste & Environmental Transport",
    description:
      "Relevant only where loads legally constitute waste or another specifically regulated environmental material.",
    icon: Package,
    laws: [
      {
        name: "Environmental Protection Act 1990",
        status: "Conditional",
        description:
          "Contains the waste duty-of-care framework and other environmental obligations relevant where waste is handled or transported.",
      },
      {
        name: "Waste (England and Wales) Regulations 2011",
        status: "Conditional",
        description:
          "Contain waste-management requirements applying in England and Wales where qualifying waste is transported or handled.",
      },
      {
        name: "Waste Carrier Registration Requirements",
        status: "Conditional",
        description:
          "Businesses transporting waste may need registration with the appropriate environmental regulator, depending on the activity and jurisdiction.",
      },
    ],
  },
  {
    id: "international",
    title: "International Transport",
    description:
      "The current Streamline platform is primarily structured around UK delivery operations. Additional law applies before international carriage is offered.",
    icon: Globe2,
    laws: [
      {
        name: "Carriage of Goods by Road Act 1965 / CMR",
        status: "Conditional",
        description:
          "Implements the CMR regime for qualifying international carriage of goods by road.",
      },
      {
        name: "International Operator Licensing Requirements",
        status: "Conditional",
        description:
          "A standard international operator licence may be required for qualifying vehicles and international hire-or-reward operations.",
      },
      {
        name: "International Drivers' Hours & Tachograph Rules",
        status: "Conditional",
        description:
          "Different drivers' hours, tachograph and vehicle rules apply according to vehicle weight and the countries involved.",
      },
      {
        name: "Customs, Import & Export Requirements",
        status: "Conditional",
        description:
          "Customs declarations, commodity restrictions, licences, duties and border requirements must be assessed before cross-border carriage is accepted.",
      },
    ],
  },
];

const compliancePrinciples = [
  {
    icon: ShieldCheck,
    title: "Privacy By Design",
    description:
      "Personal information should only be collected and used where there is a proper purpose, lawful basis and appropriate protection.",
  },
  {
    icon: FileCheck2,
    title: "Clear Customer Information",
    description:
      "Quotes, prices, booking terms and important conditions should be presented clearly before the customer commits.",
  },
  {
    icon: Truck,
    title: "Safe & Lawful Transport",
    description:
      "Drivers, vehicles, loads, operating licences and working arrangements must meet the rules applicable to each journey.",
  },
  {
    icon: UserRoundCheck,
    title: "Fair Treatment",
    description:
      "Customers, drivers and staff should be treated fairly without unlawful discrimination or misleading commercial practices.",
  },
];

export default function LegalPage() {
  return (
    <>
      <Header />

      <main>
        <section className="relative overflow-hidden bg-[#071D49] py-24 lg:py-32">
          <div className="absolute -right-32 -top-32 h-[460px] w-[460px] rounded-full bg-[#006CFF]/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-[#2D8CFF]/10 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-6">
            <div className="max-w-5xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2D8CFF]/40 bg-[#006CFF]/10 px-4 py-2">
                <Scale size={18} className="text-[#7FB6FF]" />

                <span className="text-sm font-bold uppercase tracking-[2px] text-[#7FB6FF]">
                  Legal & Compliance
                </span>
              </div>

              <h1 className="text-5xl font-bold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
                Our Legal & Compliance Framework
              </h1>

              <p className="mt-7 max-w-4xl text-lg leading-8 text-white/85 sm:text-xl">
                Streamline Logistics Group operates across several areas of UK
                law including data protection, online commerce, contracts,
                road transport, health and safety and business regulation.
              </p>

              <p className="mt-6 max-w-4xl text-base leading-7 text-white/65">
                Some requirements apply to every Streamline operation, while
                others apply only when particular vehicles, customers, goods,
                workers or journey types fall within the relevant legal regime.
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
              {compliancePrinciples.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-7"
                  >
                    <Icon size={29} className="mb-5 text-[#006CFF]" />

                    <h2 className="text-xl font-bold text-[#071D49]">
                      {item.title}
                    </h2>

                    <p className="mt-3 leading-7 text-[#4B5D7A]">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FF] py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="rounded-[2rem] border border-[#9FC5FF] bg-[#EAF2FF] p-8 sm:p-10">
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <CircleHelp
                  size={34}
                  className="shrink-0 text-[#006CFF]"
                />

                <div>
                  <h2 className="text-2xl font-bold text-[#071D49] sm:text-3xl">
                    How To Read This Page
                  </h2>

                  <p className="mt-4 leading-7 text-[#4B5D7A]">
                    A law marked{" "}
                    <strong className="text-[#071D49]">Core</strong> is part of
                    the principal compliance framework relevant to Streamline&apos;s
                    current operations.
                  </p>

                  <p className="mt-4 leading-7 text-[#4B5D7A]">
                    A law marked{" "}
                    <strong className="text-[#071D49]">Conditional</strong>{" "}
                    applies only where its legal conditions are met. This is
                    particularly important for vehicle weights, international
                    journeys, specialist goods, consumer customers, employment
                    status and regulated credit.
                  </p>

                  <p className="mt-4 leading-7 text-[#4B5D7A]">
                    The presence of specialist legislation on this page does not
                    mean Streamline accepts or is authorised to transport every
                    category of regulated goods.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FF] pb-20 lg:pb-28">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[310px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-36 lg:self-start">
              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-6 shadow-sm">
                <p className="mb-5 text-sm font-bold uppercase tracking-[2px] text-[#006CFF]">
                  Compliance Areas
                </p>

                <nav className="max-h-[70vh] space-y-2 overflow-y-auto pr-1 text-sm">
                  {legalSections.map((section) => (
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

            <div className="space-y-8">
              {legalSections.map((section) => {
                const Icon = section.icon;

                return (
                  <section
                    key={section.id}
                    id={section.id}
                    className="scroll-mt-36 overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-sm"
                  >
                    <div className="border-b border-[#D7E6FF] bg-[#071D49] p-7 sm:p-9">
                      <div className="flex items-start gap-5">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#006CFF]">
                          <Icon size={28} className="text-white" />
                        </div>

                        <div>
                          <h2 className="text-2xl font-bold text-white sm:text-3xl">
                            {section.title}
                          </h2>

                          <p className="mt-3 max-w-3xl leading-7 text-white/75">
                            {section.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-[#E3ECF9]">
                      {section.laws.map((law) => (
                        <article key={law.name} className="p-7 sm:p-9">
                          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                            <h3 className="max-w-3xl text-xl font-bold leading-7 text-[#071D49]">
                              {law.name}
                            </h3>

                            <span
                              className={`inline-flex w-fit shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[1px] ${
                                law.status === "Core"
                                  ? "bg-[#E8F7EE] text-[#176B3A]"
                                  : "bg-[#FFF4D8] text-[#8A5A00]"
                              }`}
                            >
                              {law.status}
                            </span>
                          </div>

                          <p className="mt-4 leading-7 text-[#4B5D7A]">
                            {law.description}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-14 max-w-3xl">
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                Important Operational Areas
              </p>

              <h2 className="text-4xl font-bold leading-tight text-[#071D49] lg:text-5xl">
                Compliance Goes Beyond Website Policies
              </h2>

              <p className="mt-6 text-lg leading-8 text-[#4B5D7A]">
                Legal compliance also depends on how individual deliveries,
                drivers, vehicles, workers and customer relationships are
                managed in practice.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  icon: Truck,
                  title: "Vehicle & Driver Checks",
                  description:
                    "Vehicle roadworthiness, insurance, driving entitlement, operating-licence requirements and drivers' hours must be checked against the actual vehicle and journey.",
                },
                {
                  icon: Package,
                  title: "Load Acceptance",
                  description:
                    "The nature of the goods must be established before acceptance so regulated, hazardous, controlled or specialist goods are not carried outside the correct legal framework.",
                },
                {
                  icon: Users,
                  title: "Workforce Compliance",
                  description:
                    "Employment status, pay, working time, safety, insurance, equality and right-to-work processes must reflect the people actually engaged by the business.",
                },
                {
                  icon: Database,
                  title: "Data Governance",
                  description:
                    "Retention, access control, data sharing, supplier contracts, security, privacy rights and international data transfers need operational controls as well as a published Privacy Policy.",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <article
                    key={item.title}
                    className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-8"
                  >
                    <Icon size={30} className="mb-5 text-[#006CFF]" />

                    <h3 className="text-2xl font-bold text-[#071D49]">
                      {item.title}
                    </h3>

                    <p className="mt-4 leading-7 text-[#4B5D7A]">
                      {item.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#071D49] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-12 lg:grid-cols-2">
              <div>
                <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#2D8CFF]">
                  Geographic Scope
                </p>

                <h2 className="text-4xl font-bold leading-tight text-white lg:text-5xl">
                  UK Rules Are Not Identical Everywhere
                </h2>

                <p className="mt-6 text-lg leading-8 text-white/75">
                  Some legislation applies across the United Kingdom, while
                  road transport, environmental, employment and equality
                  requirements can differ between England, Wales, Scotland and
                  Northern Ireland.
                </p>

                <p className="mt-5 text-lg leading-8 text-white/75">
                  Before expanding a particular operating model into another
                  jurisdiction, the rules applicable to that jurisdiction,
                  vehicle and load must be checked.
                </p>
              </div>

              <div className="rounded-[2rem] border border-[#1F4D94] bg-[#0B2A63] p-8 sm:p-10">
                <Landmark size={34} className="text-[#2D8CFF]" />

                <h3 className="mt-6 text-2xl font-bold text-white">
                  International Deliveries
                </h3>

                <p className="mt-4 leading-7 text-white/75">
                  International road carriage can add operator licensing,
                  customs, border, CMR, drivers&apos; hours, tachograph and
                  country-specific obligations.
                </p>

                <p className="mt-4 leading-7 text-white/75">
                  International transport should therefore be treated as a
                  separate compliance scope rather than assuming that a
                  domestic UK booking automatically satisfies overseas rules.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                Our Published Policies
              </p>

              <h2 className="text-4xl font-bold text-[#071D49] lg:text-5xl">
                Read Our Legal Information
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Link
                href="/privacy"
                className="group rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-8 transition hover:-translate-y-1 hover:border-[#006CFF] hover:shadow-xl"
              >
                <LockKeyhole size={31} className="text-[#006CFF]" />

                <h3 className="mt-6 text-2xl font-bold text-[#071D49]">
                  Privacy Policy
                </h3>

                <p className="mt-4 leading-7 text-[#4B5D7A]">
                  How personal information may be collected, used, shared,
                  retained and protected.
                </p>

                <span className="mt-7 inline-flex items-center gap-2 font-bold text-[#006CFF]">
                  Read Privacy Policy
                  <ArrowRight
                    size={18}
                    className="transition group-hover:translate-x-1"
                  />
                </span>
              </Link>

              <Link
                href="/terms"
                className="group rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-8 transition hover:-translate-y-1 hover:border-[#006CFF] hover:shadow-xl"
              >
                <Scale size={31} className="text-[#006CFF]" />

                <h3 className="mt-6 text-2xl font-bold text-[#071D49]">
                  Terms & Conditions
                </h3>

                <p className="mt-4 leading-7 text-[#4B5D7A]">
                  Terms relating to quotes, bookings, goods, payments,
                  journeys and use of Streamline services.
                </p>

                <span className="mt-7 inline-flex items-center gap-2 font-bold text-[#006CFF]">
                  Read Terms
                  <ArrowRight
                    size={18}
                    className="transition group-hover:translate-x-1"
                  />
                </span>
              </Link>

              <Link
                href="/contact"
                className="group rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-8 transition hover:-translate-y-1 hover:border-[#006CFF] hover:shadow-xl"
              >
                <Mail size={31} className="text-[#006CFF]" />

                <h3 className="mt-6 text-2xl font-bold text-[#071D49]">
                  Contact Us
                </h3>

                <p className="mt-4 leading-7 text-[#4B5D7A]">
                  Contact Streamline if you have a question about our services,
                  policies or handling of your information.
                </p>

                <span className="mt-7 inline-flex items-center gap-2 font-bold text-[#006CFF]">
                  Contact Streamline
                  <ArrowRight
                    size={18}
                    className="transition group-hover:translate-x-1"
                  />
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FF] py-20 lg:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="rounded-[2rem] border border-[#D7E6FF] bg-white p-8 sm:p-12">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <AlertTriangle
                  size={36}
                  className="shrink-0 text-[#006CFF]"
                />

                <div>
                  <h2 className="text-3xl font-bold text-[#071D49]">
                    Legal Scope Notice
                  </h2>

                  <p className="mt-5 leading-7 text-[#4B5D7A]">
                    This page provides general information about legislation and
                    regulatory areas relevant or potentially relevant to
                    Streamline Logistics Group. It is not intended to replace
                    legal advice on a particular contract, vehicle, delivery,
                    employment arrangement or regulated load.
                  </p>

                  <p className="mt-4 leading-7 text-[#4B5D7A]">
                    Whether a specific law applies can depend on facts including
                    vehicle weight, goods carried, customer status, employment
                    arrangements, company size, geographic location and the
                    exact nature of the service.
                  </p>

                  <p className="mt-4 leading-7 text-[#4B5D7A]">
                    Streamline should keep its compliance framework under review
                    as the business, services and law develop.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white pb-24 pt-4">
          <div className="mx-auto max-w-6xl px-6">
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#071D49] via-[#0B2A63] to-[#006CFF] px-8 py-14 shadow-2xl sm:px-12 lg:px-16 lg:py-16">
              <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#2D8CFF]/30 blur-3xl" />

              <div className="relative flex flex-col justify-between gap-9 lg:flex-row lg:items-center">
                <div className="max-w-2xl">
                  <p className="mb-3 text-sm font-bold uppercase tracking-[3px] text-[#7FB6FF]">
                    Need More Information?
                  </p>

                  <h2 className="text-4xl font-bold leading-tight text-white lg:text-5xl">
                    Contact Streamline
                  </h2>

                  <p className="mt-5 text-lg leading-8 text-white/80">
                    Contact us if you have a question about a Streamline policy,
                    account, booking or delivery.
                  </p>
                </div>

                <Link
                  href="/contact"
                  className="inline-flex shrink-0 items-center justify-center gap-3 rounded-full bg-white px-8 py-4 font-bold text-[#071D49] transition hover:-translate-y-1"
                >
                  Contact Us
                  <ArrowRight size={20} className="text-[#006CFF]" />
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