import { InvitationView } from "@/components/transactions/invitation";

export default function InvitationPage({ params }: { params: { token: string } }) {
  return <InvitationView token={params.token} />;
}
