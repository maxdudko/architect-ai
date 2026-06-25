import { LayoutDashboard, MessageSquare, FolderGit2, Settings, Network } from 'lucide-react';

export const appNavigation = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/repositories', label: 'Repositories', icon: FolderGit2 },
  { href: '/workspaces', label: 'Workspaces', icon: Network },
  { href: '/settings', label: 'Settings', icon: Settings },
];
