import * as z from 'zod';

export function queryResponse(type: z.ZodSchema) {
  return z.object({
    count: z.number(),
    results: z.array(type),
  });
}