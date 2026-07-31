type SchedulerSecurityEvent = {
  route: string;
  reasonCode: string;
  occurredAt?: Date;
};

export function logSchedulerSecurityRejection(input: SchedulerSecurityEvent): void {
  const event = {
    category: "SCHEDULER_AUTH_REJECTED",
    route: input.route,
    reasonCode: input.reasonCode,
    occurredAt: (input.occurredAt ?? new Date()).toISOString()
  };
  console.warn(JSON.stringify(event));
}
