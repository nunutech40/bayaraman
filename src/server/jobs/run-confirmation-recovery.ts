import "dotenv/config";
import { runCliJob } from "./run-job";

const command = process.argv[2];

if (command === "CONFIRMATION_REMINDER_SWEEP") {
  console.log(JSON.stringify((await runCliJob("confirmation-reminder")).projection));
} else if (command === "CONFIRMATION_OVERDUE_SWEEP") {
  console.log(JSON.stringify((await runCliJob("confirmation-overdue")).projection));
} else {
  throw new Error("Usage: npm run job:confirmation-recovery -- CONFIRMATION_REMINDER_SWEEP|CONFIRMATION_OVERDUE_SWEEP");
}
