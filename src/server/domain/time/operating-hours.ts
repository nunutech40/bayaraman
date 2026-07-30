const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;

function wibParts(date: Date) {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes()
  };
}

function fromWib(parts: ReturnType<typeof wibParts>): Date {
  return new Date(Date.UTC(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute
  ) - WIB_OFFSET_MS);
}

export function addOperatingMinutesWib(start: Date, minutes: number): Date {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new Error("OPERATING_MINUTES_INVALID");
  }
  let cursor = new Date(start);
  let remaining = minutes;
  while (remaining > 0) {
    const parts = wibParts(cursor);
    if (parts.hour < OPEN_HOUR) {
      cursor = fromWib({ ...parts, hour: OPEN_HOUR, minute: 0 });
      continue;
    }
    if (parts.hour >= CLOSE_HOUR) {
      const next = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
      const nextParts = wibParts(next);
      cursor = fromWib({ ...nextParts, hour: OPEN_HOUR, minute: 0 });
      continue;
    }
    const untilClose = (CLOSE_HOUR * 60) - (parts.hour * 60 + parts.minute);
    const step = Math.min(remaining, untilClose);
    cursor = new Date(cursor.getTime() + step * 60 * 1000);
    remaining -= step;
  }
  return cursor;
}
