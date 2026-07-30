import "dotenv/config";
import { runCancellationReconciliationTimeout } from "./cancellation-reconciliation-timeout";

const transitioned = await runCancellationReconciliationTimeout();
console.log(JSON.stringify({ transitioned }));
