import { z } from 'zod';

export const EditFormSchema = z.object({
  xsrf_token: z.string(),
  value: z.string().trim().min(1),
  type: z.string().optional(),
});

export type EditForm = z.infer<typeof EditFormSchema>;
