import "dotenv/config";
import { expireDuePaymentInstructions } from "./payment-expiry";

expireDuePaymentInstructions()
  .then((expired) => {
    console.log(`Expired payment instructions: ${expired}`);
  })
  .catch((error: unknown) => {
    console.error("Payment expiry job failed", error);
    process.exitCode = 1;
  });
