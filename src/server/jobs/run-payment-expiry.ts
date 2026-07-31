import "dotenv/config";
import { runCliJob } from "./run-job";

runCliJob("payment-expiry")
  .then(({ projection }) => {
    console.log(JSON.stringify(projection));
  })
  .catch((error: unknown) => {
    console.error("Payment expiry job failed", error instanceof Error ? error.message : "JOB_FAILED");
    process.exitCode = 1;
  });
