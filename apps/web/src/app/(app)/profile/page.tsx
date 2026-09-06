import { ProfileSection } from '@/features/profile';
import { PageHeader } from '@/shared/components';

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Manage your name and account details." />
      <ProfileSection />
    </div>
  );
}
