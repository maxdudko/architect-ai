import { AnalyticsDashboard } from '@/features/admin';
import { PageHeader } from '@/shared/components';

export default function AdminAnalyticsPage() {
  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Platform usage metrics, source citations, and answer feedback."
      />
      <AnalyticsDashboard />
    </div>
  );
}
