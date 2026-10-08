export type VehicleDetails = {
  label: string;
  length: string;
  width: string;
  height: string;
  pallets: string;
  maxWeight: string;
  image: string;
};

// Category load-space figures supplied by Streamline, 8 October 2026.
// Keys stay identical to the existing quote and availability vehicle categories.
export const vehicleDetails: Record<string, VehicleDetails> = {
  "Small Van": {
    label: "Small Van", length: "1.3 m", width: "1.2 m", height: "1.0 m",
    pallets: "Up to 1", maxWeight: "400 kg", image: "/Vehicles/smallvan.png",
  },
  "SWB Van": {
    label: "SWB Van", length: "2.1 m", width: "1.2 m", height: "1.4 m",
    pallets: "Up to 2", maxWeight: "800 kg", image: "/Vehicles/swb.png",
  },
  "LWB High Roof Van": {
    label: "LWB High Roof Van", length: "3.3 m", width: "1.2 m", height: "1.7 m",
    pallets: "Up to 3", maxWeight: "1,200 kg", image: "/Vehicles/lwb.png",
  },
  "XLWB High Roof Van": {
    label: "XLWB High Roof Van", length: "4.2 m", width: "1.2 m", height: "1.75 m",
    pallets: "Up to 4", maxWeight: "1,000 kg", image: "/Vehicles/xlwb.png",
  },
  "Luton Tail Lift Van": {
    label: "Luton Tail Lift Van", length: "4.2 m", width: "2.0 m", height: "2.1 m",
    pallets: "Up to 6", maxWeight: "1,000 kg", image: "/Vehicles/luton.png",
  },
};
