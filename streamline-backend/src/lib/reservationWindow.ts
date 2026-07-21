const VEHICLE_BLOCK_HOURS = 6;
const MIN_VEHICLE_BLOCK_HOURS = 1;
const MAX_VEHICLE_BLOCK_HOURS = 48;
const UK_TIME_ZONE = "Europe/London";

function getTimeZoneOffsetMs(timeZone: string, date: Date) {
  const zonedDate = new Date(
    date.toLocaleString("en-US", {
      timeZone,
    }),
  );

  const utcDate = new Date(
    date.toLocaleString("en-US", {
      timeZone: "UTC",
    }),
  );

  return zonedDate.getTime() - utcDate.getTime();
}

function createUtcDateFromUkLocalTime(
  collectionDate: string,
  hours: number,
  minutes: number,
) {
  const [year, month, day] = collectionDate.split("-").map(Number);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }

  const utcGuess = new Date(
    Date.UTC(year, month - 1, day, hours, minutes, 0, 0),
  );

  const offsetMs = getTimeZoneOffsetMs(UK_TIME_ZONE, utcGuess);

  return new Date(utcGuess.getTime() - offsetMs);
}

function resolveVehicleBlockHours(vehicleBlockHours: number | undefined) {
  if (
    !Number.isInteger(vehicleBlockHours) ||
    vehicleBlockHours === undefined ||
    vehicleBlockHours < MIN_VEHICLE_BLOCK_HOURS ||
    vehicleBlockHours > MAX_VEHICLE_BLOCK_HOURS
  ) {
    return VEHICLE_BLOCK_HOURS;
  }

  return vehicleBlockHours;
}

export function getReservationWindow(
  collectionDate: Date | string,
  collectionWindow: string,
  vehicleBlockHours = VEHICLE_BLOCK_HOURS,
) {
  const dateString =
    typeof collectionDate === "string"
      ? collectionDate.slice(0, 10)
      : collectionDate.toISOString().slice(0, 10);

  const [start] = collectionWindow.split("-");
  const [hours, minutes] = start.split(":").map(Number);

  const reservedFrom = createUtcDateFromUkLocalTime(
    dateString,
    hours,
    minutes,
  );

  if (!reservedFrom || Number.isNaN(reservedFrom.getTime())) {
    throw new Error("Invalid collection date or collection window.");
  }

  const resolvedVehicleBlockHours = resolveVehicleBlockHours(vehicleBlockHours);
  const reservedUntil = new Date(reservedFrom);
  reservedUntil.setHours(
    reservedUntil.getHours() + resolvedVehicleBlockHours,
  );

  return {
    reservedFrom,
    reservedUntil,
  };
}