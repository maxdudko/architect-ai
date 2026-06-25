import { AcceptInvitationForm } from '@/features/invitation';

interface AcceptInvitationPageProps {
  params: Promise<{ token: string }>;
}

export default async function AcceptInvitationPage({ params }: AcceptInvitationPageProps) {
  const { token } = await params;
  return <AcceptInvitationForm token={token} />;
}
