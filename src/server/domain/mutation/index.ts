import { assertExpectedStateVersion } from "@/server/domain/transaction/state";
import type { MutationInput } from "@/server/validation/mutation";
import { parseMutationInput } from "@/server/validation/mutation";

export type MutationContext = MutationInput & {
  correlationId: string;
};

export function createMutationContext(
  input: unknown,
  correlationId: string
): MutationContext {
  return {
    ...parseMutationInput(input),
    correlationId
  };
}

export function assertMutationVersion(
  currentStateVersion: number,
  context: MutationContext
): void {
  if (context.expectedStateVersion !== undefined) {
    assertExpectedStateVersion(currentStateVersion, context.expectedStateVersion);
  }
}
