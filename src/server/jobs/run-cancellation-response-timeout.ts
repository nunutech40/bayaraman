import "dotenv/config";
import { runCliJob } from "./run-job";

console.log(JSON.stringify((await runCliJob("cancellation-response-timeout")).projection));
