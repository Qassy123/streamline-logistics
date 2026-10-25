import type { Prisma } from "@prisma/client";
const categories: Record<string, string[]> = {
  "Small Van": ["Small Van"], "SWB Van": ["SWB Van"], "LWB High Roof Van": ["LWB High Roof Van", "LWB Van"],
  "XLWB High Roof Van": ["XLWB High Roof Van", "XLWB High Roof"], "Luton Tail Lift Van": ["Luton Tail Lift Van", "Luton Tail Lift"],
};
export function dispatchCategoryFilter(category: string): Prisma.BookingWhereInput | null {
  const values = categories[category];
  if (!values) return null;
  const noType = { OR: [{ vehicleType: null }, { vehicleType: "" }] };
  return { OR: [
    { vehicleType: { in: values } },
    { AND: [noType, { quote: { is: { vehicleSize: { in: values } } } }] },
    { AND: [noType, { OR: [{ quote: { is: null } }, { quote: { is: { vehicleSize: "" } } }] }, { vehicle: { is: { vehicleType: { in: values } } } }] },
  ] };
}
