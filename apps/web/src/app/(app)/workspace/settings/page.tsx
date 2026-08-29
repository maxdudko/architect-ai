import { redirect } from 'next/navigation';

interface WorkspaceSettingsPageProps {
  searchParams: Promise<{ billing?: string }>;
}

export default async function WorkspaceSettingsPage({ searchParams }: WorkspaceSettingsPageProps) {
  const { billing } = await searchParams;
  if (billing) {
    redirect(`/workspaces?billing=${encodeURIComponent(billing)}`);
  }
  redirect('/workspaces');
}
