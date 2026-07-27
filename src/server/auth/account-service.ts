import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { hashPassword, verifyPassword } from "./password";
import type { AccountInput } from "./account-schema";

export async function registerAccount(input: AccountInput) {
  const passwordHash = await hashPassword(input.password);
  const [account] = await db
    .insert(accounts)
    .values({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      whatsappNumber: input.whatsappNumber
    })
    .returning({
      id: accounts.id,
      email: accounts.email,
      displayName: accounts.displayName,
      whatsappNumber: accounts.whatsappNumber,
      isAdmin: accounts.isAdmin,
      whatsappVerifiedAt: accounts.whatsappVerifiedAt
    });

  if (!account) {
    throw new Error("Unable to create account");
  }

  return account;
}

export async function authenticateAccount(email: string, password: string) {
  const account = await db.query.accounts.findFirst({
    where: sql`lower(${accounts.email}) = ${email.toLowerCase()}`
  });

  if (!account?.passwordHash || !(await verifyPassword(account.passwordHash, password))) {
    return null;
  }

  return account;
}

export async function findAccount(accountId: string) {
  return db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
}
