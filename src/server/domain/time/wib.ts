const WIB_TIME_ZONE = "Asia/Jakarta";

export function formatWib(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false
  }).format(date);
}

export function isWithinAdminOperatingHoursWib(date: Date): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: WIB_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23"
  }).format(date));
  return hour >= 9 && hour < 21;
}
