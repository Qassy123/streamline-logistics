import FleetVehicleRecord from "@/components/admin/FleetVehicleRecord";
export default async function FleetVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FleetVehicleRecord id={id} />;
}
