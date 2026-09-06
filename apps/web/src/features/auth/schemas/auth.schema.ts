import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, 'Use uppercase, lowercase, and a number');

export const signInSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signUpSchema = signInSchema.extend({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email'),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
