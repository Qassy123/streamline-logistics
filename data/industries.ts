export type Industry = {
  slug: string;
  title: string;
  shortTitle?: string;
  image: string;
  description: string;
  eyebrow: string;
  heroTitle: string;
  heroDescription: string;
  introTitle: string;
  introParagraphs: string[];
  transportItems: {
    title: string;
    description: string;
  }[];
  services: {
    title: string;
    description: string;
  }[];
  benefits: string[];
  scenarios: {
    title: string;
    description: string;
  }[];
  faqs: {
    question: string;
    answer: string;
  }[];
};

export const industries: Industry[] = [
  {
    slug: "construction",
    title: "Construction",
    image: "/images/industries/construction.jpg",
    description:
      "Urgent site deliveries, materials, tools and project support logistics.",
    eyebrow: "Construction Logistics",
    heroTitle: "Construction Courier & Logistics Services",
    heroDescription:
      "Time-critical transport for construction businesses that need tools, materials, equipment and essential project items moved without unnecessary delay.",
    introTitle: "Keep Projects Moving When Timing Matters",
    introParagraphs: [
      "Construction schedules can change quickly. A missing component, delayed tool or urgent supplier collection can affect far more than one delivery.",
      "Streamline Logistics Group provides business courier support designed around those operational demands, helping move goods between suppliers, depots, offices and active project locations.",
      "From planned movements to urgent same-day requirements, transport can be arranged around the route, capacity and timing required for the job.",
    ],
    transportItems: [
      {
        title: "Tools & Equipment",
        description:
          "Move essential tools, replacement equipment and operational supplies between suppliers, depots and construction sites.",
      },
      {
        title: "Site Materials",
        description:
          "Dedicated transport for materials and project items that need to reach site without unnecessary handling or delays.",
      },
      {
        title: "Replacement Parts",
        description:
          "Urgent collection and delivery of components and replacement parts when downtime is affecting a project.",
      },
      {
        title: "Documents & Samples",
        description:
          "Reliable movement of plans, samples, project documentation and other business-critical items.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "For urgent construction requirements where goods need to move quickly from collection point to site.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Arrange deliveries across multiple sites, suppliers or project locations within one journey.",
      },
      {
        title: "Return Journeys",
        description:
          "Collect from site, complete the required delivery and return goods where your job requires it.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Your consignment travels in the assigned vehicle for a more direct and controlled delivery journey.",
      },
    ],
    benefits: [
      "UK-wide business delivery support",
      "Urgent and pre-arranged collections",
      "Dedicated vehicle options",
      "Multi-drop and return journey support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business and trade account options",
      "Transport sized around the job",
    ],
    scenarios: [
      {
        title: "A site is waiting for a replacement part",
        description:
          "A critical component fails or is missing. We collect from your supplier and move it directly to the required site.",
      },
      {
        title: "Materials need moving between projects",
        description:
          "Stock or equipment needs to move from one active location to another without disrupting your wider operation.",
      },
      {
        title: "A supplier order becomes urgent",
        description:
          "Your normal supply chain cannot meet the required deadline, so a dedicated collection is arranged to keep work moving.",
      },
    ],
    faqs: [
      {
        question: "Can you deliver directly to construction sites?",
        answer:
          "Yes. Collection and delivery details can be entered for construction sites, suppliers, depots, offices and other suitable business locations.",
      },
      {
        question: "Can I arrange an urgent same-day construction delivery?",
        answer:
          "Yes. Streamline supports time-sensitive business deliveries, subject to vehicle availability and the collection requirements entered during quoting.",
      },
      {
        question: "Can a delivery include more than one construction site?",
        answer:
          "Yes. Multi-drop journeys can include additional stops where goods need to be collected from or delivered to multiple locations.",
      },
      {
        question: "Can I book a return journey?",
        answer:
          "Yes. Return journeys are supported where goods, equipment or other items need to travel back after the initial delivery.",
      },
    ],
  },
  {
    slug: "aviation",
    title: "Aviation",
    image: "/images/industries/aviation.jpg",
    description:
      "Time-critical collections and deliveries for aviation businesses.",
    eyebrow: "Aviation Logistics",
    heroTitle: "Aviation Courier & Logistics Services",
    heroDescription:
      "Fast, dependable transport support for aviation businesses handling urgent parts, equipment, documents and operational supplies.",
    introTitle: "Time-Critical Support For Aviation Operations",
    introParagraphs: [
      "Aviation businesses often operate to tight schedules where delays can quickly create operational problems.",
      "Streamline supports urgent and planned collections between suppliers, maintenance locations, offices and other aviation-related sites.",
      "Transport can be arranged around the timing, route and load requirements of each job.",
    ],
    transportItems: [
      {
        title: "Aircraft Parts",
        description:
          "Urgent movement of replacement components and business-critical aviation parts.",
      },
      {
        title: "Tools & Equipment",
        description:
          "Transport support for maintenance tools, testing equipment and operational supplies.",
      },
      {
        title: "Documents",
        description:
          "Reliable collection and delivery of important paperwork and business documents.",
      },
      {
        title: "Operational Supplies",
        description:
          "Move essential supplies between aviation businesses, suppliers and operational locations.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "Fast collection and delivery support for urgent aviation requirements.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Coordinate collections or deliveries across multiple aviation-related locations.",
      },
      {
        title: "Return Journeys",
        description:
          "Suitable where items need to return to the original collection point after delivery.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Direct transport for business-critical consignments requiring controlled movement.",
      },
    ],
    benefits: [
      "UK-wide collection and delivery",
      "Urgent transport support",
      "Dedicated vehicle options",
      "Multi-drop journey support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business account options",
      "Flexible vehicle capacity",
    ],
    scenarios: [
      {
        title: "A replacement component is required urgently",
        description:
          "A part needs collecting from a supplier and moving directly to the required operational location.",
      },
      {
        title: "Equipment must move between facilities",
        description:
          "Tools or equipment need transferring quickly between business locations.",
      },
      {
        title: "A routine delivery becomes time-sensitive",
        description:
          "A planned movement becomes urgent and requires a dedicated collection.",
      },
    ],
    faqs: [
      {
        question: "Can you transport urgent aviation parts?",
        answer:
          "Yes. Streamline can support urgent business transport requirements for aviation-related goods, subject to load suitability and vehicle availability.",
      },
      {
        question: "Do you offer same-day aviation courier services?",
        answer:
          "Yes. Same-day options are available for urgent business deliveries where suitable collection windows and vehicles are available.",
      },
      {
        question: "Can you collect from multiple suppliers?",
        answer:
          "Yes. Multi-drop journeys can include additional collection or delivery stops.",
      },
      {
        question: "Can I track the delivery?",
        answer:
          "Operational tracking is supported for active bookings where tracking has been enabled.",
      },
    ],
  },
  {
    slug: "hospitality",
    title: "Hospitality",
    image: "/images/industries/hospitality.jpg",
    description:
      "Reliable transport support for venues, suppliers and hospitality groups.",
    eyebrow: "Hospitality Logistics",
    heroTitle: "Hospitality Courier & Logistics Services",
    heroDescription:
      "Reliable transport support for venues, suppliers, hotels, restaurants and hospitality businesses across the UK.",
    introTitle: "Reliable Deliveries For Busy Hospitality Operations",
    introParagraphs: [
      "Hospitality businesses depend on timing, stock availability and smooth coordination between suppliers and venues.",
      "Streamline helps move essential business goods quickly when standard delivery arrangements are not enough.",
      "From urgent supplier collections to planned venue deliveries, journeys can be arranged around your operational requirements.",
    ],
    transportItems: [
      {
        title: "Venue Supplies",
        description:
          "Move essential operational supplies directly to hotels, venues and hospitality businesses.",
      },
      {
        title: "Equipment",
        description:
          "Transport business equipment and replacement items between suppliers and venues.",
      },
      {
        title: "Printed Materials",
        description:
          "Deliver menus, signage, promotional materials and event-related print items.",
      },
      {
        title: "Business Stock",
        description:
          "Dedicated movement of suitable stock and supplies required for day-to-day operations.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "Useful when a venue needs an urgent supplier collection or replacement item.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Support for groups operating across multiple venues or locations.",
      },
      {
        title: "Return Journeys",
        description:
          "Arrange collection, delivery and return where equipment or goods need moving back.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Direct transport for hospitality businesses requiring greater control over the journey.",
      },
    ],
    benefits: [
      "UK-wide coverage",
      "Urgent collections",
      "Venue-to-venue transport",
      "Multi-drop support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business account options",
      "Flexible vehicle selection",
    ],
    scenarios: [
      {
        title: "A venue is missing essential equipment",
        description:
          "A replacement item is collected from the supplier and delivered directly to the venue.",
      },
      {
        title: "Multiple locations require deliveries",
        description:
          "Goods can be moved across several hospitality sites within a multi-drop journey.",
      },
      {
        title: "Supplier stock is needed urgently",
        description:
          "An urgent supplier collection helps prevent operational disruption.",
      },
    ],
    faqs: [
      {
        question: "Can you deliver directly to hotels and venues?",
        answer:
          "Yes. Suitable business addresses can be used as collection and delivery points.",
      },
      {
        question: "Can you handle urgent hospitality deliveries?",
        answer:
          "Yes. Same-day transport options are available subject to timing and vehicle availability.",
      },
      {
        question: "Can I arrange deliveries to multiple venues?",
        answer:
          "Yes. Multi-drop journeys support additional stops where required.",
      },
      {
        question: "Do you support business accounts?",
        answer:
          "Yes. Streamline supports business and trade account options.",
      },
    ],
  },
  {
    slug: "farming",
    title: "Farming",
    image: "/images/industries/farming.jpg",
    description:
      "Dependable movement of supplies and equipment across agricultural operations.",
    eyebrow: "Agricultural Logistics",
    heroTitle: "Farming & Agricultural Courier Services",
    heroDescription:
      "Dependable business transport for agricultural supplies, equipment, parts and operational goods across the UK.",
    introTitle: "Transport Support For Agricultural Operations",
    introParagraphs: [
      "Agricultural businesses often operate across multiple sites and rely on equipment and supplies being available when needed.",
      "Streamline provides flexible courier support between suppliers, farms, depots and other business locations.",
      "Urgent collections and planned journeys can be arranged around your route and vehicle requirements.",
    ],
    transportItems: [
      {
        title: "Equipment Parts",
        description:
          "Urgent transport of suitable replacement parts for agricultural machinery and equipment.",
      },
      {
        title: "Tools & Supplies",
        description:
          "Move operational tools and business supplies between suppliers and agricultural sites.",
      },
      {
        title: "Packaged Goods",
        description:
          "Dedicated transport for suitable packaged agricultural business goods.",
      },
      {
        title: "Documents & Samples",
        description:
          "Reliable movement of business documents and suitable non-restricted samples.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "Fast response when an agricultural business requires an urgent item or replacement part.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Transport goods across several farms, suppliers or operational locations.",
      },
      {
        title: "Return Journeys",
        description:
          "Arrange return transport when equipment, goods or documents need moving back.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Vehicle options suited to different business load requirements.",
      },
    ],
    benefits: [
      "UK-wide transport support",
      "Urgent supplier collections",
      "Rural business deliveries",
      "Multi-site journey support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business account options",
      "Flexible vehicle capacity",
    ],
    scenarios: [
      {
        title: "A machinery part is urgently required",
        description:
          "A supplier collection can be arranged to move the required part directly to the agricultural business.",
      },
      {
        title: "Supplies need moving between locations",
        description:
          "Operational goods can be transferred between sites using a dedicated journey.",
      },
      {
        title: "Several locations require deliveries",
        description:
          "A multi-drop journey can support multiple agricultural business locations.",
      },
    ],
    faqs: [
      {
        question: "Can you deliver to rural business locations?",
        answer:
          "Yes, provided the collection or delivery location is accessible and suitable for the assigned vehicle.",
      },
      {
        question: "Can you transport agricultural equipment parts?",
        answer:
          "Yes, where the goods are suitable for transport and fit within the selected vehicle capacity.",
      },
      {
        question: "Can I arrange a same-day collection?",
        answer:
          "Yes, subject to vehicle availability and suitable collection timing.",
      },
      {
        question: "Do you support multi-drop journeys?",
        answer:
          "Yes. Additional stops can be included where required.",
      },
    ],
  },
  {
    slug: "marketing-print",
    title: "Marketing & Print",
    image: "/images/industries/marketing.jpg",
    description:
      "Printed materials, displays and campaign assets delivered on schedule.",
    eyebrow: "Marketing & Print Logistics",
    heroTitle: "Marketing & Print Courier Services",
    heroDescription:
      "Time-sensitive delivery support for printed materials, signage, campaign assets, displays and business marketing goods.",
    introTitle: "Deliver Campaign Materials On Schedule",
    introParagraphs: [
      "Print and marketing deadlines are often fixed, leaving little room for delayed collections or missed deliveries.",
      "Streamline supports agencies, printers, suppliers and businesses that need campaign materials moved quickly and reliably.",
      "Journeys can be arranged for single deliveries, multiple destinations or urgent last-minute requirements.",
    ],
    transportItems: [
      {
        title: "Printed Materials",
        description:
          "Brochures, leaflets, posters and other suitable printed business materials.",
      },
      {
        title: "Signage",
        description:
          "Transport for suitable signage, boards and display materials.",
      },
      {
        title: "Campaign Assets",
        description:
          "Move marketing materials and promotional assets to clients, venues or campaign locations.",
      },
      {
        title: "Display Equipment",
        description:
          "Dedicated transport for suitable stands, display items and event marketing equipment.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "Useful for urgent print deadlines and campaign materials required the same day.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Deliver campaign materials to multiple branches, venues or customer locations.",
      },
      {
        title: "Return Journeys",
        description:
          "Collect display items or equipment and return them after use where required.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Direct movement for campaign materials without unnecessary intermediate handling.",
      },
    ],
    benefits: [
      "UK-wide business delivery",
      "Deadline-focused collections",
      "Multi-location distribution",
      "Return journey support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business account options",
      "Flexible vehicle selection",
    ],
    scenarios: [
      {
        title: "Print is completed later than expected",
        description:
          "A dedicated collection helps move finished materials directly to the required client or venue.",
      },
      {
        title: "Campaign materials need multiple deliveries",
        description:
          "A multi-drop route supports distribution across several business locations.",
      },
      {
        title: "Display equipment needs returning",
        description:
          "A return journey can be arranged after the event or campaign activity.",
      },
    ],
    faqs: [
      {
        question: "Can you transport printed materials same day?",
        answer:
          "Yes. Same-day collection and delivery can be arranged subject to vehicle availability and timing.",
      },
      {
        question: "Can you deliver to multiple branches or venues?",
        answer:
          "Yes. Multi-drop journeys support several stops in one booking.",
      },
      {
        question: "Can you transport display equipment?",
        answer:
          "Yes, where the goods are suitable and fit within the selected vehicle capacity.",
      },
      {
        question: "Can I arrange a return collection?",
        answer:
          "Yes. Return journeys are supported.",
      },
    ],
  },
  {
    slug: "pharmaceutical-medical",
    title: "Pharmaceutical & Medical",
    shortTitle: "Pharmaceutical & Medical",
    image: "/images/industries/pharmacy.jpg",
    description:
      "Professional handling of medical supplies and business-critical deliveries.",
    eyebrow: "Medical Logistics",
    heroTitle: "Pharmaceutical & Medical Courier Services",
    heroDescription:
      "Professional business transport support for suitable medical supplies, equipment, documents and operational goods.",
    introTitle: "Dependable Transport For Time-Sensitive Medical Operations",
    introParagraphs: [
      "Medical and pharmaceutical organisations often require dependable delivery coordination and clear handling processes.",
      "Streamline supports suitable business goods moving between suppliers, offices, clinics and other commercial locations.",
      "Each booking is arranged around the route, load, vehicle and timing requirements entered by the customer.",
    ],
    transportItems: [
      {
        title: "Medical Supplies",
        description:
          "Transport support for suitable packaged medical business supplies.",
      },
      {
        title: "Equipment",
        description:
          "Movement of suitable medical and operational equipment between business locations.",
      },
      {
        title: "Documents",
        description:
          "Reliable business courier support for important operational paperwork.",
      },
      {
        title: "Business Stock",
        description:
          "Dedicated movement of suitable packaged pharmaceutical or medical business goods.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "For urgent suitable business consignments requiring prompt collection and delivery.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Coordinate deliveries across several suitable business locations.",
      },
      {
        title: "Return Journeys",
        description:
          "Arrange return transport where suitable goods or equipment need moving back.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Direct vehicle allocation for suitable time-sensitive business consignments.",
      },
    ],
    benefits: [
      "UK-wide business transport",
      "Urgent collection options",
      "Dedicated vehicle options",
      "Multi-location support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business account options",
      "Clear booking information",
    ],
    scenarios: [
      {
        title: "A business location needs urgent supplies",
        description:
          "Suitable packaged goods can be collected and moved directly to the required destination.",
      },
      {
        title: "Equipment needs transferring between locations",
        description:
          "A dedicated journey can support movement between suitable business sites.",
      },
      {
        title: "Several locations require deliveries",
        description:
          "A multi-drop route can support multiple commercial destinations.",
      },
    ],
    faqs: [
      {
        question: "Can you transport medical supplies?",
        answer:
          "Streamline can transport suitable, lawful business goods that meet the service and vehicle requirements. Regulated, controlled or specialist items may require arrangements outside the standard service.",
      },
      {
        question: "Do you provide same-day medical courier services?",
        answer:
          "Same-day transport is available for suitable business goods subject to timing and vehicle availability.",
      },
      {
        question: "Can I track an active booking?",
        answer:
          "Operational tracking is supported where tracking has been enabled for the booking.",
      },
      {
        question: "Do you offer proof of delivery?",
        answer:
          "Proof of delivery is supported through the delivery workflow.",
      },
    ],
  },
  {
    slug: "film-production",
    title: "Film & Production",
    image: "/images/industries/film.jpg",
    description:
      "Equipment, props and production assets transported safely and efficiently.",
    eyebrow: "Film & Production Logistics",
    heroTitle: "Film & Production Courier Services",
    heroDescription:
      "Flexible transport support for production equipment, props, materials and other suitable business assets.",
    introTitle: "Courier Support That Works Around Production Schedules",
    introParagraphs: [
      "Film and production schedules can change quickly and often involve several suppliers, locations and deadlines.",
      "Streamline helps production businesses move suitable equipment and assets between studios, suppliers, offices and filming locations.",
      "Urgent, multi-drop and return journeys can be arranged around the requirements of the production.",
    ],
    transportItems: [
      {
        title: "Production Equipment",
        description:
          "Suitable equipment moved between suppliers, studios and production locations.",
      },
      {
        title: "Props",
        description:
          "Dedicated transport for suitable props and production assets.",
      },
      {
        title: "Printed Materials",
        description:
          "Scripts, documents, signage and other suitable business print items.",
      },
      {
        title: "Operational Supplies",
        description:
          "Business supplies required to support filming and production activity.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "Useful for last-minute production requirements and urgent collections.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Support for journeys involving suppliers, studios and multiple production locations.",
      },
      {
        title: "Return Journeys",
        description:
          "Return props, equipment or other suitable goods after production use.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Vehicle allocation around the size and requirements of the production load.",
      },
    ],
    benefits: [
      "UK-wide production support",
      "Urgent collection options",
      "Multi-location journeys",
      "Return journey support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business account options",
      "Vehicle capacity options",
    ],
    scenarios: [
      {
        title: "Equipment is needed at another location",
        description:
          "A dedicated vehicle can move suitable production equipment directly between locations.",
      },
      {
        title: "A prop is required urgently",
        description:
          "An urgent collection can help move a suitable production asset to set.",
      },
      {
        title: "Equipment must be returned after filming",
        description:
          "A return journey can be arranged as part of the transport requirement.",
      },
    ],
    faqs: [
      {
        question: "Can you deliver to filming locations?",
        answer:
          "Yes, where the location is accessible and suitable for the assigned vehicle.",
      },
      {
        question: "Can you transport production equipment?",
        answer:
          "Yes, where the goods are suitable and within the selected vehicle capacity.",
      },
      {
        question: "Can a journey include multiple locations?",
        answer:
          "Yes. Multi-drop journeys support additional stops.",
      },
      {
        question: "Can equipment be returned after use?",
        answer:
          "Yes. Return journeys are supported.",
      },
    ],
  },
  {
    slug: "events",
    title: "Events",
    image: "/images/industries/event.jpg",
    description:
      "Supporting events with dependable collection and delivery services.",
    eyebrow: "Event Logistics",
    heroTitle: "Event Courier & Logistics Services",
    heroDescription:
      "Reliable transport support for venues, organisers, suppliers and businesses working to fixed event deadlines.",
    introTitle: "Keep Event Deliveries Running To Schedule",
    introParagraphs: [
      "Events depend on timing. Late equipment, missing materials or delayed supplier collections can quickly cause problems.",
      "Streamline supports event organisers, suppliers and businesses with dedicated transport between commercial locations and venues.",
      "Journeys can be arranged for urgent requirements, multiple destinations and return collections.",
    ],
    transportItems: [
      {
        title: "Event Equipment",
        description:
          "Move suitable business equipment and event assets between suppliers and venues.",
      },
      {
        title: "Displays & Signage",
        description:
          "Dedicated transport for suitable signage, stands and display materials.",
      },
      {
        title: "Printed Materials",
        description:
          "Deliver programmes, promotional print and event documentation.",
      },
      {
        title: "Operational Supplies",
        description:
          "Move suitable event supplies required before, during or after an event.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "For urgent event requirements where timing is critical.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Support deliveries across suppliers, venues and multiple event locations.",
      },
      {
        title: "Return Journeys",
        description:
          "Collect suitable equipment or materials after an event and return them.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Transport sized around the load and event requirement.",
      },
    ],
    benefits: [
      "UK-wide venue support",
      "Urgent collection options",
      "Multi-drop journeys",
      "Return collection support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business account options",
      "Flexible vehicle capacity",
    ],
    scenarios: [
      {
        title: "A venue is missing equipment",
        description:
          "A supplier collection can be arranged to move suitable equipment directly to the event location.",
      },
      {
        title: "Several venues require materials",
        description:
          "A multi-drop route can support distribution across multiple event locations.",
      },
      {
        title: "Equipment needs collecting after the event",
        description:
          "A return journey can move suitable goods back to the supplier or business location.",
      },
    ],
    faqs: [
      {
        question: "Can you deliver directly to event venues?",
        answer:
          "Yes, provided the location is accessible and suitable for the assigned vehicle.",
      },
      {
        question: "Can you arrange urgent event deliveries?",
        answer:
          "Yes. Same-day options are available subject to timing and vehicle availability.",
      },
      {
        question: "Can you deliver to several venues?",
        answer:
          "Yes. Multi-drop journeys support multiple stops.",
      },
      {
        question: "Can you collect equipment after the event?",
        answer:
          "Yes. Return journeys are supported.",
      },
    ],
  },
  {
    slug: "professional-services",
    title: "Professional Services",
    image: "/images/industries/professional.jpg",
    description:
      "Secure document, parcel and office logistics support.",
    eyebrow: "Professional Services Logistics",
    heroTitle: "Professional Services Courier Support",
    heroDescription:
      "Reliable business transport for documents, parcels, office equipment and operational goods.",
    introTitle: "Dependable Courier Support For Professional Businesses",
    introParagraphs: [
      "Professional organisations often need items moving between offices, clients, suppliers and other business locations.",
      "Streamline provides dedicated courier support for suitable business goods where timing and reliability matter.",
      "Bookings can be arranged for urgent movements, planned journeys or deliveries involving multiple locations.",
    ],
    transportItems: [
      {
        title: "Business Documents",
        description:
          "Reliable transport for suitable business documents and paperwork.",
      },
      {
        title: "Office Equipment",
        description:
          "Move suitable equipment and operational items between offices.",
      },
      {
        title: "Parcels",
        description:
          "Dedicated business parcel transport where a direct journey is required.",
      },
      {
        title: "Printed Materials",
        description:
          "Transport suitable reports, presentation materials and other business print.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "For urgent business items that need moving quickly.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Support journeys across offices, clients and multiple commercial locations.",
      },
      {
        title: "Return Journeys",
        description:
          "Arrange return transport where items need moving back.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Direct transport for suitable business goods.",
      },
    ],
    benefits: [
      "UK-wide business delivery",
      "Urgent collection options",
      "Office-to-office transport",
      "Multi-drop support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business account options",
      "Dedicated vehicle options",
    ],
    scenarios: [
      {
        title: "Documents are required urgently",
        description:
          "A direct collection can move suitable documents to the required business location.",
      },
      {
        title: "Equipment needs moving between offices",
        description:
          "A dedicated vehicle can transport suitable office equipment.",
      },
      {
        title: "Several client locations require deliveries",
        description:
          "A multi-drop journey can support several commercial stops.",
      },
    ],
    faqs: [
      {
        question: "Can you transport business documents?",
        answer:
          "Yes. Suitable business documents can be moved through the courier service.",
      },
      {
        question: "Can you provide same-day office deliveries?",
        answer:
          "Yes, subject to collection timing and vehicle availability.",
      },
      {
        question: "Can I include several offices in one booking?",
        answer:
          "Yes. Multi-drop journeys support additional stops.",
      },
      {
        question: "Do you provide proof of delivery?",
        answer:
          "Yes. Proof of delivery is supported through the delivery workflow.",
      },
    ],
  },
  {
    slug: "education",
    title: "Education",
    image: "/images/industries/education.jpg",
    description:
      "Transport solutions for schools, colleges and training providers.",
    eyebrow: "Education Logistics",
    heroTitle: "Education Courier & Logistics Services",
    heroDescription:
      "Business transport support for schools, colleges, training providers, suppliers and education organisations.",
    introTitle: "Reliable Deliveries For Education Organisations",
    introParagraphs: [
      "Education organisations often need equipment, documents and operational goods moving between suppliers and multiple sites.",
      "Streamline provides flexible business courier support for suitable goods and commercial deliveries.",
      "Journeys can be arranged around urgent requirements, planned movements and multiple destinations.",
    ],
    transportItems: [
      {
        title: "Equipment",
        description:
          "Transport suitable educational and operational equipment between business locations.",
      },
      {
        title: "Documents",
        description:
          "Reliable movement of suitable business documents and administrative materials.",
      },
      {
        title: "Printed Materials",
        description:
          "Deliver suitable printed resources and business materials.",
      },
      {
        title: "Operational Supplies",
        description:
          "Move suitable supplies between suppliers and education organisations.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "Support for urgent suitable business deliveries.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Useful for organisations operating across multiple locations.",
      },
      {
        title: "Return Journeys",
        description:
          "Arrange collection, delivery and return where required.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Direct transport for suitable business goods.",
      },
    ],
    benefits: [
      "UK-wide business support",
      "Urgent collection options",
      "Multi-site deliveries",
      "Return journey support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business account options",
      "Vehicle capacity options",
    ],
    scenarios: [
      {
        title: "Equipment is urgently needed at another site",
        description:
          "A dedicated collection can move suitable equipment directly between locations.",
      },
      {
        title: "Materials need distributing across several sites",
        description:
          "A multi-drop route can support several education-related business locations.",
      },
      {
        title: "A supplier delivery becomes urgent",
        description:
          "A same-day collection can help move suitable goods without waiting for a standard delivery cycle.",
      },
    ],
    faqs: [
      {
        question: "Can you deliver to schools and colleges?",
        answer:
          "Yes, where the location is suitable and accessible for the assigned vehicle.",
      },
      {
        question: "Can you transport equipment?",
        answer:
          "Yes, where the goods are suitable and within the selected vehicle capacity.",
      },
      {
        question: "Can you deliver to several sites?",
        answer:
          "Yes. Multi-drop journeys support multiple locations.",
      },
      {
        question: "Can I arrange an urgent delivery?",
        answer:
          "Yes, subject to timing and vehicle availability.",
      },
    ],
  },
  {
    slug: "arts-antiques",
    title: "Arts & Antiques",
    image: "/images/industries/arts.jpg",
    description:
      "Careful transportation of valuable and delicate items.",
    eyebrow: "Arts & Antiques Logistics",
    heroTitle: "Arts & Antiques Courier Services",
    heroDescription:
      "Dedicated business transport for suitable artwork, antiques, display pieces and valuable commercial goods.",
    introTitle: "Careful Transport For Valuable Business Goods",
    introParagraphs: [
      "Art and antique businesses often require a more considered approach to transport.",
      "Streamline provides dedicated vehicle options for suitable commercial goods moving between galleries, dealers, suppliers and other business locations.",
      "The booking process allows the customer to provide load information and any relevant handling instructions.",
    ],
    transportItems: [
      {
        title: "Artwork",
        description:
          "Dedicated transport for suitable artwork and commercial display pieces.",
      },
      {
        title: "Antiques",
        description:
          "Transport support for suitable antique business goods.",
      },
      {
        title: "Display Items",
        description:
          "Move suitable exhibition and gallery display assets.",
      },
      {
        title: "Business Collections",
        description:
          "Transport suitable commercial collections between business locations.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "For suitable urgent movements where timing is important.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Support journeys involving galleries, suppliers or several commercial locations.",
      },
      {
        title: "Return Journeys",
        description:
          "Arrange return transport where suitable goods need moving back.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Direct vehicle allocation for suitable business consignments.",
      },
    ],
    benefits: [
      "Dedicated vehicle options",
      "UK-wide business transport",
      "Load instructions captured",
      "Return journey support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business account options",
      "Flexible vehicle capacity",
    ],
    scenarios: [
      {
        title: "Artwork needs moving between galleries",
        description:
          "A dedicated journey can move suitable commercial artwork between locations.",
      },
      {
        title: "An item needs collecting from a dealer",
        description:
          "A suitable business collection can be arranged directly from the supplier or dealer.",
      },
      {
        title: "Display items need returning",
        description:
          "A return journey can support collection after an exhibition or display.",
      },
    ],
    faqs: [
      {
        question: "Can you transport artwork and antiques?",
        answer:
          "Streamline can transport suitable lawful business goods that meet the load and vehicle requirements. Specialist items requiring controlled environments or specialist handling may need arrangements outside the standard service.",
      },
      {
        question: "Can I provide handling instructions?",
        answer:
          "Yes. The booking flow includes fields for load and special instructions.",
      },
      {
        question: "Can I request a dedicated vehicle?",
        answer:
          "The service uses assigned vehicle capacity based on the booking requirement.",
      },
      {
        question: "Can I arrange a return journey?",
        answer:
          "Yes. Return journeys are supported.",
      },
    ],
  },
  {
    slug: "utilities",
    title: "Utilities",
    image: "/images/industries/utilities.jpg",
    description:
      "Fast response delivery support for utility providers and contractors.",
    eyebrow: "Utilities Logistics",
    heroTitle: "Utilities Courier & Logistics Services",
    heroDescription:
      "Fast business transport support for utility providers, contractors, suppliers and operational teams.",
    introTitle: "Delivery Support For Time-Critical Utility Operations",
    introParagraphs: [
      "Utility operations can be affected quickly when equipment, parts or supplies are delayed.",
      "Streamline helps move suitable business goods between suppliers, depots, contractors and operational locations.",
      "Urgent same-day and planned journeys can be arranged around the route and load requirements.",
    ],
    transportItems: [
      {
        title: "Replacement Parts",
        description:
          "Urgent transport of suitable replacement components.",
      },
      {
        title: "Tools & Equipment",
        description:
          "Move suitable operational tools and equipment between business locations.",
      },
      {
        title: "Supplies",
        description:
          "Transport suitable packaged supplies required by contractors and utility businesses.",
      },
      {
        title: "Documents",
        description:
          "Reliable movement of suitable business documents and paperwork.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "Fast response for suitable urgent operational requirements.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Support routes involving suppliers, depots and several operational locations.",
      },
      {
        title: "Return Journeys",
        description:
          "Arrange return movement where goods or equipment need transporting back.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Vehicle allocation around the business load requirement.",
      },
    ],
    benefits: [
      "UK-wide business support",
      "Urgent collection options",
      "Supplier-to-site transport",
      "Multi-drop support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business account options",
      "Flexible vehicle capacity",
    ],
    scenarios: [
      {
        title: "A replacement component is needed urgently",
        description:
          "A supplier collection can help move the suitable part directly to the operational location.",
      },
      {
        title: "Equipment needs moving between depots",
        description:
          "A dedicated journey can support suitable goods moving between business locations.",
      },
      {
        title: "Several teams require deliveries",
        description:
          "A multi-drop route can support several suitable commercial destinations.",
      },
    ],
    faqs: [
      {
        question: "Can you support urgent utility deliveries?",
        answer:
          "Yes. Same-day transport is available subject to suitable goods, timing and vehicle availability.",
      },
      {
        question: "Can you deliver directly to operational sites?",
        answer:
          "Yes, where the location is suitable and accessible for the assigned vehicle.",
      },
      {
        question: "Can you collect from several suppliers?",
        answer:
          "Yes. Multi-drop journeys support additional stops.",
      },
      {
        question: "Do you provide tracking?",
        answer:
          "Operational tracking is supported where enabled for the active booking.",
      },
    ],
  },
  {
    slug: "fmcg",
    title: "Fast-Moving Consumer Goods",
    shortTitle: "FMCG",
    image: "/images/industries/fast.jpg",
    description:
      "Reliable logistics support for high-volume consumer products.",
    eyebrow: "FMCG Logistics",
    heroTitle: "FMCG Courier & Logistics Services",
    heroDescription:
      "Flexible transport support for suitable packaged consumer goods, business stock and urgent supply requirements.",
    introTitle: "Reliable Transport For Fast-Moving Business Stock",
    introParagraphs: [
      "Fast-moving consumer goods businesses operate around stock availability, distribution schedules and customer demand.",
      "Streamline supports suitable business consignments moving between suppliers, warehouses, branches and other commercial locations.",
      "Urgent and planned journeys can be arranged around the route and vehicle capacity required.",
    ],
    transportItems: [
      {
        title: "Packaged Goods",
        description:
          "Transport suitable packaged consumer goods between commercial locations.",
      },
      {
        title: "Business Stock",
        description:
          "Move suitable stock between suppliers, warehouses and branches.",
      },
      {
        title: "Promotional Materials",
        description:
          "Deliver suitable displays and campaign materials alongside business operations.",
      },
      {
        title: "Operational Supplies",
        description:
          "Dedicated movement of suitable supplies supporting business activity.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "For urgent suitable stock movements and supplier collections.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Support distribution across several commercial destinations.",
      },
      {
        title: "Return Journeys",
        description:
          "Arrange return movement where suitable goods need transporting back.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Vehicle capacity selected around the load requirement.",
      },
    ],
    benefits: [
      "UK-wide business transport",
      "Urgent stock movements",
      "Multi-drop distribution",
      "Return journey support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business account options",
      "Flexible vehicle capacity",
    ],
    scenarios: [
      {
        title: "A branch needs stock urgently",
        description:
          "Suitable stock can be collected from a supplier or warehouse and moved directly to the branch.",
      },
      {
        title: "Several locations need deliveries",
        description:
          "A multi-drop route can support suitable goods across several commercial destinations.",
      },
      {
        title: "A supplier delivery is delayed",
        description:
          "A dedicated collection can help move suitable goods without waiting for the normal delivery cycle.",
      },
    ],
    faqs: [
      {
        question: "Can you transport FMCG stock?",
        answer:
          "Streamline can transport suitable lawful packaged business goods within the vehicle and service requirements.",
      },
      {
        question: "Can you deliver to several branches?",
        answer:
          "Yes. Multi-drop journeys support additional destinations.",
      },
      {
        question: "Can I arrange a same-day stock transfer?",
        answer:
          "Yes, subject to suitable goods, timing and vehicle availability.",
      },
      {
        question: "Can I use a business account?",
        answer:
          "Yes. Business and trade account options are supported.",
      },
    ],
  },
  {
    slug: "automotive",
    title: "Automotive",
    image: "/images/industries/automotive.jpg",
    description:
      "Parts, stock and business deliveries for the automotive sector.",
    eyebrow: "Automotive Logistics",
    heroTitle: "Automotive Courier & Logistics Services",
    heroDescription:
      "Time-critical transport for automotive parts, tools, equipment and suitable business stock.",
    introTitle: "Keep Automotive Operations Moving",
    introParagraphs: [
      "Automotive businesses often depend on parts and equipment arriving quickly enough to keep work moving.",
      "Streamline supports suitable business goods moving between suppliers, workshops, dealerships and other commercial locations.",
      "Urgent same-day collections and planned transport can be arranged around the job.",
    ],
    transportItems: [
      {
        title: "Vehicle Parts",
        description:
          "Urgent transport for suitable automotive components and replacement parts.",
      },
      {
        title: "Tools & Equipment",
        description:
          "Move suitable workshop tools and business equipment.",
      },
      {
        title: "Business Stock",
        description:
          "Transport suitable automotive stock between suppliers and commercial locations.",
      },
      {
        title: "Documents",
        description:
          "Reliable movement of suitable business paperwork and operational documents.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "Fast collection for urgent automotive parts and suitable business goods.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Support routes involving suppliers, workshops and dealerships.",
      },
      {
        title: "Return Journeys",
        description:
          "Arrange return movement where suitable goods or components need transporting back.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Vehicle allocation based on the size and capacity requirements of the load.",
      },
    ],
    benefits: [
      "UK-wide automotive support",
      "Urgent supplier collections",
      "Workshop and dealership deliveries",
      "Multi-drop support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business account options",
      "Flexible vehicle capacity",
    ],
    scenarios: [
      {
        title: "A workshop is waiting for a part",
        description:
          "A supplier collection can move the suitable replacement part directly to the workshop.",
      },
      {
        title: "Stock needs moving between locations",
        description:
          "Suitable business stock can be transferred between commercial automotive locations.",
      },
      {
        title: "Several dealerships require deliveries",
        description:
          "A multi-drop journey can support several suitable business destinations.",
      },
    ],
    faqs: [
      {
        question: "Can you deliver automotive parts same day?",
        answer:
          "Yes. Same-day delivery is available for suitable goods subject to timing and vehicle availability.",
      },
      {
        question: "Can you collect directly from parts suppliers?",
        answer:
          "Yes. Suitable supplier addresses can be used as collection locations.",
      },
      {
        question: "Can one journey include several dealerships?",
        answer:
          "Yes. Multi-drop journeys support additional stops.",
      },
      {
        question: "Can you transport larger parts?",
        answer:
          "The selected vehicle must have sufficient capacity for the load entered during quoting.",
      },
    ],
  },
  {
    slug: "wholesale",
    title: "Wholesale",
    image: "/images/industries/wholesale.jpg",
    description:
      "Efficient movement of wholesale goods and business inventory.",
    eyebrow: "Wholesale Logistics",
    heroTitle: "Wholesale Courier & Logistics Services",
    heroDescription:
      "Flexible transport for suitable wholesale goods, business inventory and urgent stock movements.",
    introTitle: "Business Transport That Supports Stock Movement",
    introParagraphs: [
      "Wholesale businesses rely on stock moving efficiently between suppliers, warehouses and customers.",
      "Streamline provides dedicated courier support for suitable business goods requiring direct transport.",
      "Journeys can be arranged around urgent stock requirements, multiple destinations and return movements.",
    ],
    transportItems: [
      {
        title: "Wholesale Goods",
        description:
          "Transport suitable packaged wholesale stock between commercial locations.",
      },
      {
        title: "Business Inventory",
        description:
          "Move suitable inventory between warehouses, suppliers and business customers.",
      },
      {
        title: "Operational Supplies",
        description:
          "Dedicated transport for suitable goods supporting wholesale operations.",
      },
      {
        title: "Promotional Materials",
        description:
          "Move suitable business display and promotional materials where required.",
      },
    ],
    services: [
      {
        title: "Same-Day Delivery",
        description:
          "Urgent suitable stock movement where a standard delivery schedule is too slow.",
      },
      {
        title: "Multi-Drop Deliveries",
        description:
          "Distribute suitable goods across several business locations.",
      },
      {
        title: "Return Journeys",
        description:
          "Arrange return movement where suitable goods need collecting again.",
      },
      {
        title: "Dedicated Vehicles",
        description:
          "Vehicle capacity selected around the wholesale load requirement.",
      },
    ],
    benefits: [
      "UK-wide business transport",
      "Urgent stock movements",
      "Multi-location distribution",
      "Return journey support",
      "Live operational tracking capability",
      "Proof of delivery",
      "Business account options",
      "Flexible vehicle capacity",
    ],
    scenarios: [
      {
        title: "A customer needs stock urgently",
        description:
          "Suitable stock can be collected from the warehouse and moved directly to the business customer.",
      },
      {
        title: "Several customers require deliveries",
        description:
          "A multi-drop route can support multiple suitable commercial destinations.",
      },
      {
        title: "Stock needs moving between warehouses",
        description:
          "A dedicated journey can support suitable inventory transfers between business locations.",
      },
    ],
    faqs: [
      {
        question: "Can you transport wholesale stock?",
        answer:
          "Yes. Suitable lawful packaged business goods can be transported within the service and vehicle requirements.",
      },
      {
        question: "Can you deliver to multiple customers?",
        answer:
          "Yes. Multi-drop journeys support several destinations.",
      },
      {
        question: "Can I arrange urgent stock transport?",
        answer:
          "Yes. Same-day options are available subject to timing and vehicle availability.",
      },
      {
        question: "Do you support business accounts?",
        answer:
          "Yes. Business and trade account options are supported.",
      },
    ],
  },
];

export function getIndustryBySlug(slug: string) {
  return industries.find((industry) => industry.slug === slug);
}