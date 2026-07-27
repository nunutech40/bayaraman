import { createHash } from "node:crypto";
import { z } from "zod";

export const mutationInputSchema = z.object({
  actorScope: z.string().regex(/^(ACCOUNT:[0-9a-f-]{36}|SYSTEM:[A-Za-z0-9._-]+)$/),
  command: z.string().min(1).max(120),
  idempotencyKey: z.string().min(8).max(200),
  requestHash: z.string().min(1).max(128),
  expectedStateVersion: z.number().int().nonnegative().optional()
});

export type MutationInput = z.infer<typeof mutationInputSchema>;

export function hashRequest(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

export function parseMutationInput(input: unknown): MutationInput {
  return mutationInputSchema.parse(input);
}
