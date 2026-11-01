import Link from "next/link";
import Image from "next/image";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { industries } from "@/data/industries";
export const metadata={title:"Industries | Streamline Logistics Group",description:"Explore Streamline’s courier services for your industry."};
export default function IndustriesPage(){return <><Header/><main className="bg-[#F4F8FF] px-5 py-12 text-[#071D49]"><div className="mx-auto max-w-7xl"><p className="text-sm font-bold uppercase tracking-widest text-[#006CFF]">Industries we serve</p><h1 className="mt-3 text-4xl font-bold">Deliveries that keep your business moving.</h1><p className="mt-4 max-w-2xl">Find dedicated courier support for your sector.</p><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{industries.map(item=><Link key={item.slug} href={`/industries/${item.slug}`} className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:border-[#006CFF]"><div className="relative h-44"><Image src={item.image} alt={item.title} fill className="object-cover"/></div><div className="p-5"><h2 className="text-xl font-bold">{item.title}</h2><p className="mt-2 text-sm text-slate-600">{item.description}</p><span className="mt-4 inline-block font-bold text-[#006CFF]">Explore services →</span></div></Link>)}</div></div></main><Footer/></>}
