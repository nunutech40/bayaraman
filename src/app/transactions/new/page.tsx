import { CreateTransaction } from "@/components/transactions/create-transaction";

export default function NewTransactionPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = searchParams.role === "BUYER" ? "BUYER" : "SELLER";
  return <CreateTransaction role={role} />;
}
