import Header from "@/components/layout/Header";
import Hero from "@/components/homepage/Hero";
import Intro from "@/components/homepage/Intro";
import Services from "@/components/homepage/Services";
import WhyChooseUs from "@/components/homepage/WhyChooseUs";
import LogisticsProvider from "@/components/homepage/LogisticsProvider";
import Industries from "@/components/homepage/Industries";
import UrgentDeliveryCTA from "@/components/homepage/UrgentDeliveryCTA";
import FAQ from "@/components/homepage/FAQ";
import Promise from "@/components/homepage/Promise";
import CTA from "@/components/homepage/CTA";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <Hero />
      <Intro />
      <Services />
      <WhyChooseUs />
      <LogisticsProvider />
      <Industries />
      <FAQ />
      <Promise />
      <CTA />
      <Footer />
    </>
  );
}