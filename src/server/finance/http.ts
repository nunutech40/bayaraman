export function financialHttpStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHENTICATED") return 401;
  if (message === "FORBIDDEN" || message.includes("ASSIGNMENT")) return 403;
  if (message.includes("NOT_FOUND") || message.includes("NOT FOUND")) return 404;
  if (message.includes("VERSION") || message.includes("CONFLICT") ||
      message.includes("ALREADY") || message.includes("REQUIRED") ||
      message.includes("NOT_READY") || message.includes("NOT_ELIGIBLE") ||
      message.includes("NOT_ALLOWED") || message.includes("NOT_PREPARED") ||
      message.includes("UNKNOWN")) return 409;
  return 400;
}
