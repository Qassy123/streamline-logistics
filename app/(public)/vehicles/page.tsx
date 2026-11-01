import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import VehicleComparison from "@/components/VehicleComparison";
export const metadata={title:"Vehicles | Streamline Logistics Group",description:"Explore and compare Streamline courier van categories."};
export default function VehiclesPage(){return <><Header/><main className="bg-[#F4F8FF] px-5 py-12 text-[#071D49]"><div className="mx-auto max-w-6xl"><p className="text-sm font-bold uppercase tracking-widest text-[#006CFF]">Our vehicles</p><h1 className="mt-3 text-4xl font-bold">The right van for your delivery.</h1><p className="mb-8 mt-4 max-w-2xl">Explore load space and capacity, then compare the vans that suit your goods.</p><VehicleComparison/></div></main><Footer/></>}
