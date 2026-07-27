import { findAccount } from "./account-service";
import { getCurrentSession } from "./cookies";
import { recordAuthEvent } from "./audit";

async function denyAuthorization(
  accountId: string | undefined,
  resource: string,
  reasonCategory: string
): Promise<never> {
  try {
    await recordAuthEvent("AUTHORIZATION_DENIED", accountId, { resource, reasonCategory });
  } catch {
    // Authorization denial must not become a different application error if audit storage is unavailable.
  }
  throw new Error(accountId ? "FORBIDDEN" : "UNAUTHENTICATED");
}

export async function requireAuthenticatedAccount() {
  const session = await getCurrentSession();
  if (!session) {
    return denyAuthorization(undefined, "authenticated_resource", "INVALID_SESSION");
  }

  const account = await findAccount(session.accountId);
  if (!account) {
    return denyAuthorization(session.accountId, "authenticated_resource", "ACCOUNT_NOT_FOUND");
  }

  return { session, account };
}

export async function requireAdminAccount() {
  const result = await requireAuthenticatedAccount();
  if (!result.account.isAdmin) {
    return denyAuthorization(result.account.id, "admin_resource", "ADMIN_REQUIRED");
  }

  return result;
}

export function canParticipate(account: { whatsappVerifiedAt: Date | null }): boolean {
  return account.whatsappVerifiedAt !== null;
}
