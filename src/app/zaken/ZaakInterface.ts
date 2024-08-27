import { z } from 'zod';

export const ZaakSummarySchema = z.object({
  identifier: z.string(),
  internal_id: z.string(),
  registratiedatum: z.coerce.date(),
  verwachtte_einddatum: z.coerce.date().optional(),
  uiterlijke_einddatum: z.coerce.date().optional(),
  einddatum: z.coerce.date().optional().nullable(),
  zaak_type: z.string(),
  status: z.string().nullable(),
  resultaat: z.string().optional().nullable(),
}).passthrough();
export const ZaakSummariesSchema = z.array(ZaakSummarySchema);

export type ZaakSummary = z.infer<typeof ZaakSummarySchema>;

export const singleZaakSchema = z.object({
  identifier: z.string(),
  internal_id: z.string(),
  registratiedatum: z.coerce.date().optional(),
  verwachtte_einddatum: z.coerce.date().optional(),
  uiterlijke_einddatum: z.coerce.date().optional(),
  einddatum: z.coerce.date().optional(),
  zaak_type: z.string(),
  status: z.string().optional(),
  status_list: z.array(z.any()).optional(),
  resultaat: z.string().optional().nullable(),
  documenten: z.array(z.any()).optional(),
  taken: z.array(z.any()).optional().nullable(),
  behandelaars: z.array(z.string()).optional(),
  type: z.enum(['case', 'submission']),
});
export type SingleZaak = z.infer<typeof singleZaakSchema>;
