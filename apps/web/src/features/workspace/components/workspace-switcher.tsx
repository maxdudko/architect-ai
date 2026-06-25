'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components';
import { cn } from '@/lib/utils';
import { useWorkspaceSwitcher } from '../hooks/use-workspace-switcher';

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, switchWorkspace, isLoading } = useWorkspaceSwitcher();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">{activeWorkspace?.name ?? 'Select workspace'}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        {isLoading ? (
          <DropdownMenuItem disabled>Loading workspaces...</DropdownMenuItem>
        ) : (
          workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              className="flex items-center justify-between"
              onClick={() => void switchWorkspace(workspace.id)}
            >
              <span className="truncate">{workspace.name}</span>
              <Check
                className={cn(
                  'h-4 w-4',
                  workspace.id === activeWorkspace?.id ? 'opacity-100' : 'opacity-0',
                )}
              />
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
