import { ChatWindow } from '@/features/chat';
import { PageHeader } from '@/shared/components';

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat"
        description="Ask onboarding questions about your indexed repositories."
      />
      <ChatWindow />
    </div>
  );
}
