export function cancellationHttpStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHENTICATED") return 401;
  if (message.includes("FORBIDDEN") || message.includes("ASSIGNMENT")) return 403;
  if (message.includes("NOT_FOUND")) return 404;
  if (
    message.includes("CONFLICT") ||
    message.includes("VERSION") ||
    message.includes("ACTIVE") ||
    message.includes("FINAL") ||
    message.includes("IDEMPOTENCY") ||
    message.includes("CUTOFF") ||
    message.includes("NOT_ELIGIBLE")
  ) return 409;
  return 400;
}
