import { z } from 'zod';

export const VerifyFormSchema = z.object({
  xsrf_token: z.string(),
  code: z.string().trim().regex(/^\d{6}$/),
  type: z.string().optional(),
});

export type VerifyForm = z.infer<typeof VerifyFormSchema>;
