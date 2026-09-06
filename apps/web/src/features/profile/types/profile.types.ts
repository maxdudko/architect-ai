import type { z } from 'zod';
import { updateProfileSchema } from '../schemas/profile.schema';

export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;
