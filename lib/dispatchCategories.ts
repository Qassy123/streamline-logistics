export const dispatchCategories = ["Small Van", "SWB Van", "LWB High Roof Van", "XLWB High Roof Van", "Luton Tail Lift Van"] as const;
export function dispatchCategory(job: { vehicleType?: string | null; quote?: { vehicleSize?: string | null } | null; vehicle?: { vehicleType?: string | null } | null }) {
  const value = job.vehicleType || job.quote?.vehicleSize || job.vehicle?.vehicleType || "Other vehicles";
  return ({ "LWB Van": "LWB High Roof Van", "XLWB High Roof": "XLWB High Roof Van", "Luton Tail Lift": "Luton Tail Lift Van" } as Record<string, string>)[value] || value;
}
