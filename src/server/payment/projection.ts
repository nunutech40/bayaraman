export function maskReceivingAccount(value: string): string {
  return `••••${value.slice(-4)}`;
}

export function formatWib(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "long",
    timeStyle: "short"
  }).format(value) + " WIB";
}
