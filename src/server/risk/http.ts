export function riskHttpStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHENTICATED") return 401;
  if (message === "FORBIDDEN" || message.includes("ASSIGNMENT") || message.includes("FORBIDDEN")) return 403;
  if (message.includes("NOT_FOUND") || message.includes("NOT FOUND")) return 404;
  if (message.includes("VERSION") || message.includes("CONFLICT") ||
      message.includes("ACTIVE") || message.includes("PENDING") ||
      message.includes("FINAL") || message.includes("IDEMPOTENCY")) return 409;
  return 400;
}
