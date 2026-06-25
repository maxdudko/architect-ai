import { z } from 'zod';

export const acceptInvitationSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, 'Use uppercase, lowercase, and a number'),
});

export type AcceptInvitationFormValues = z.infer<typeof acceptInvitationSchema>;
