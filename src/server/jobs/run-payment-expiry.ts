import "dotenv/config";
import { expirePaymentInvoices } from "./payment-expiry";

expirePaymentInvoices()
  .then((expired) => {
    console.log(`Expired payment invoices: ${expired}`);
  })
  .catch((error: unknown) => {
    console.error("Payment expiry job failed", error);
    process.exitCode = 1;
  });
