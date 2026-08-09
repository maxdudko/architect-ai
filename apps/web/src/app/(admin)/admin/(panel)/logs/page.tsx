import { LogsList } from '@/features/admin';
import { PageHeader } from '@/shared/components';

export default function AdminLogsPage() {
  return (
    <div>
      <PageHeader
        title="Logs"
        description="HTTP request and audit events recorded by the API."
      />
      <LogsList />
    </div>
  );
}
