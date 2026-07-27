import { TransactionStatus } from "@/components/transactions/status";

export default function TransactionPage({ params }: { params: { id: string } }) {
  return <TransactionStatus transactionId={params.id} />;
}
