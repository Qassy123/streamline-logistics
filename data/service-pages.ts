export const servicePages = [
  {
    slug: "same-day-delivery",
    title: "Same Day Delivery",
    shortDescription: "Urgent collection and direct delivery for businesses.",
    heroTitle: "Same Day Business Delivery",
    intro:
      "When your business needs goods moved quickly, Streamline Logistics Group provides dependable same-day collection and delivery support across the UK.",
    sections: [
      {
        title: "Fast Collection And Delivery",
        text: "We help businesses move urgent parcels, stock, equipment and important goods from collection point to destination without unnecessary delay.",
      },
      {
        title: "Built For Business Needs",
        text: "Our same-day delivery service is designed for companies that need reliable transport, clear communication and professional handling from start to finish.",
      },
    ],
  },
  {
    slug: "full-day-half-day-rates",
    title: "Full Day & Half Day Rates",
    shortDescription: "Flexible delivery support for scheduled business work.",
    heroTitle: "Full Day & Half Day Courier Rates",
    intro:
      "For businesses that need delivery support for several hours or a full working day, our flexible booking options give you dependable transport without overcomplication.",
    sections: [
      {
        title: "Flexible Business Support",
        text: "Book delivery support for half-day or full-day requirements, ideal for planned routes, repeated collections, business errands and time-sensitive work.",
      },
      {
        title: "Clear Pricing",
        text: "We keep pricing straightforward so your business knows what to expect before the job begins.",
      },
    ],
  },
  {
    slug: "multi-drop-delivery",
    title: "Multi-Drop Delivery",
    shortDescription: "Efficient routes for multiple delivery points.",
    heroTitle: "Multi-Drop Delivery Services",
    intro:
      "Streamline Logistics Group helps businesses complete multiple deliveries in one planned route, saving time and keeping operations moving.",
    sections: [
      {
        title: "Multiple Stops, One Route",
        text: "Ideal for businesses sending goods to several customers, branches, sites or locations in a single delivery run.",
      },
      {
        title: "Organised And Reliable",
        text: "We help structure the route clearly so each delivery is handled professionally and efficiently.",
      },
    ],
  },
  {
    slug: "parcel-delivery",
    title: "Parcel Delivery",
    shortDescription: "Secure parcel delivery for business goods.",
    heroTitle: "Business Parcel Delivery",
    intro:
      "Our parcel delivery service gives businesses a reliable way to move important packages, documents and commercial goods safely.",
    sections: [
      {
        title: "Business Parcels Handled Properly",
        text: "From small packages to important business items, we provide collection and delivery support with care and clear communication.",
      },
      {
        title: "Simple Booking",
        text: "Tell us what needs collecting, where it is going and when it needs to arrive. We handle the movement.",
      },
    ],
  },
  {
    slug: "full-load",
    title: "Full Load",
    shortDescription: "Dedicated delivery for larger consignments.",
    heroTitle: "Full Load Delivery Services",
    intro:
      "For larger business consignments, Streamline Logistics Group provides full-load delivery support focused on safe, direct and reliable transport.",
    sections: [
      {
        title: "Larger Business Deliveries",
        text: "Suitable for stock movements, larger consignments, equipment and commercial goods that require more space.",
      },
      {
        title: "Handled From Collection To Drop-Off",
        text: "We keep the process clear from the moment goods are collected through to successful delivery.",
      },
    ],
  },
];

export function getServicePage(slug: string) {
  return servicePages.find((service) => service.slug === slug);
}