import { useAuth } from '@/providers/auth-provider';

export function useAuthService() {
  const auth = useAuth();

  return {
    signIn: auth.signIn,
    signUp: auth.signUp,
    logout: auth.logout,
  };
}
