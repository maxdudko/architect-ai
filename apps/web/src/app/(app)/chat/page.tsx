import { ChatPlaceholder } from '@/features/chat';
import { PageHeader } from '@/shared/components';

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat"
        description="Codebase chat assistant is planned for the next phase."
      />
      <ChatPlaceholder />
    </div>
  );
}
