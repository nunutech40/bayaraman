import "dotenv/config";
import { runConfirmationOverdueSweep, runConfirmationReminderSweep } from "@/server/confirmation/recovery";

const command = process.argv[2];

if (command === "CONFIRMATION_REMINDER_SWEEP") {
  await runConfirmationReminderSweep();
} else if (command === "CONFIRMATION_OVERDUE_SWEEP") {
  await runConfirmationOverdueSweep();
} else {
  throw new Error("Usage: npm run job:confirmation-recovery -- CONFIRMATION_REMINDER_SWEEP|CONFIRMATION_OVERDUE_SWEEP");
}
