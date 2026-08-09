'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAdminAuth } from '@/providers/admin-auth-provider';

const adminSignInSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type AdminSignInFormValues = z.infer<typeof adminSignInSchema>;

export function useAdminSignInForm() {
  const { signIn } = useAdminAuth();

  const form = useForm<AdminSignInFormValues>({
    resolver: zodResolver(adminSignInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await signIn(values);
    } catch {
      toast.error('Unable to sign in. Please check your credentials.');
    }
  });

  return { form, onSubmit };
}
