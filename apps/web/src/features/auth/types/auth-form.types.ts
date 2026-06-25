import type { z } from 'zod';
import { signInSchema, signUpSchema } from '../schemas/auth.schema';

export type SignInFormValues = z.infer<typeof signInSchema>;
export type SignUpFormValues = z.infer<typeof signUpSchema>;
