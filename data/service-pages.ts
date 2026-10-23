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
    slug:"next-day-delivery",title:"Next Day Delivery",shortDescription:"Reliable next-day transport for planned business deliveries.",heroTitle:"Next Day Business Delivery",intro:"Plan your business collection and delivery with our next-day courier service.",
    sections:[{title:"Planned business deliveries",text:"Arrange collection and delivery details when booking your next-day service."}]
  },
];

export function getServicePage(slug: string) {
  return servicePages.find((service) => service.slug === slug);
}