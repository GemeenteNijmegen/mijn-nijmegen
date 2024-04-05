import { z } from 'zod';

export const InzendingSchema = z.object({
  userId: z.string(),
  key: z.string(),
  pdf: z.string(),
  dateSubmitted: z.coerce.date(),
  formName: z.string(),
  formTitle: z.string(),
  attachments: z.array(z.string()),
});

export const InzendingenSchema = z.array(InzendingSchema);
export type Inzending = z.infer<typeof InzendingSchema>;
