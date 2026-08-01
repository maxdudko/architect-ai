import { ChatWindow } from '@/features/chat';
import { PageHeader } from '@/shared/components';

interface ChatPageProps {
  searchParams: Promise<{ repositoryId?: string }>;
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const { repositoryId } = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat"
        description="Ask onboarding questions about your indexed repositories."
      />
      <ChatWindow initialRepositoryId={repositoryId} />
    </div>
  );
}
