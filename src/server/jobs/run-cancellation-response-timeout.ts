import "dotenv/config";
import { runCancellationResponseTimeout } from "./cancellation-response-timeout";

const transitioned = await runCancellationResponseTimeout();
console.log(JSON.stringify({ transitioned }));
