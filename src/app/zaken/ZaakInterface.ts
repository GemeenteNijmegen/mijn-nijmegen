import { z } from 'zod';

export const TaakSummarySchema = z.object({
  title: z.string(),
  url: z.string(),
  zaak_uuid: z.string().optional(),
  uuid: z.string(),
  einddatum: z.string(),
  is_open: z.boolean(),
  is_afgerond: z.boolean(),
  is_verwerkt: z.boolean(),
  is_gesloten: z.boolean(),
  attachments: z.array(z.object({
    title: z.string(),
    url: z.string(),
  }),
  ).optional().nullable(),
}).passthrough();
export type TaakSummary = z.infer<typeof TaakSummarySchema>;
export const TaakSummariesSchema = z.array(TaakSummarySchema);

/**
 * Response schema from zaakaggregator for taak summaries
 */
export const TaakSummariesResponseSchema = z.object({
  incompleteResults: z.boolean(),
  results: TaakSummariesSchema,
});

/**
 * Response type from zaakaggregator for taak summaries
 */
export type TaakSummariesResponse = z.infer<typeof TaakSummariesResponseSchema>;


export const ZaakSummarySchema = z.object({
  identifier: z.string(),
  internal_id: z.string(),
  registratiedatum: z.coerce.date(),
  verwachtte_einddatum: z.coerce.date().optional(),
  uiterlijke_einddatum: z.coerce.date().optional(),
  einddatum: z.coerce.date().optional().nullable(),
  zaak_type: z.string().optional(),
  zaak_identifier: z.string().optional(),
  status: z.string().nullable(),
  resultaat: z.string().optional().nullable(),
}).passthrough();
export const ZaakSummariesSchema = z.array(ZaakSummarySchema);

export type ZaakSummary = z.infer<typeof ZaakSummarySchema>;

/**
 * Response schema from zaakaggregator for zaak summaries
 */
export const ZaakSummariesResponseSchema = z.object({
  incompleteResults: z.boolean(),
  results: ZaakSummariesSchema,
});

/**
 * Response type from zaakaggregator for zaak summaries
 */
export type ZaakSummariesResponse = z.infer<typeof ZaakSummariesResponseSchema>;

export const singleZaakSchema = z.object({
  identifier: z.string(),
  internal_id: z.string(),
  registratiedatum: z.coerce.date().optional(),
  verwachtte_einddatum: z.coerce.date().optional(),
  uiterlijke_einddatum: z.coerce.date().optional(),
  einddatum: z.coerce.date().optional(),
  zaak_type: z.string().optional(),
  zaak_identifier: z.string().optional(),
  status: z.string().optional(),
  status_list: z.array(z.any()).optional(),
  resultaat: z.string().optional().nullable(),
  documenten: z.array(z.any()).optional(),
  taken: z.array(TaakSummarySchema).optional().nullable(),
  behandelaars: z.array(z.string()).optional(),
  type: z.enum(['case', 'submission', 'case_with_submission']),
});
export type SingleZaak = z.infer<typeof singleZaakSchema>;
