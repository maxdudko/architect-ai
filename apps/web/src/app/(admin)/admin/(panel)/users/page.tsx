import { UsersList } from '@/features/admin';
import { PageHeader } from '@/shared/components';

export default function AdminUsersPage() {
  return (
    <div>
      <PageHeader title="Users" description="Read-only directory of registered platform users." />
      <UsersList />
    </div>
  );
}
