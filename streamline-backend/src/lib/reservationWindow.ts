const VEHICLE_BLOCK_HOURS = 6;
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

export function getReservationWindow(
  collectionDate: Date | string,
  collectionWindow: string,
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

  const reservedUntil = new Date(reservedFrom);
  reservedUntil.setHours(reservedUntil.getHours() + VEHICLE_BLOCK_HOURS);

  return {
    reservedFrom,
    reservedUntil,
  };
}
