'use client';

import { useAuth } from '@/providers/auth-provider';

export function useInvitationAuth() {
  const auth = useAuth();

  return {
    acceptInvitation: auth.acceptInvitation,
    logout: auth.logout,
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
  };
}
