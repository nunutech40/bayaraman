import BuyerConfirmation from "@/components/confirmation/buyer-confirmation";

export default function ConfirmationPage({ params }: { params: { token: string } }) {
  return <BuyerConfirmation token={params.token} />;
}
