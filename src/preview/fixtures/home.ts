import { ZaakSummary, TaakSummary } from '../../app/zaken/ZaakInterface';

export const homeSession = {
  username: 'Jan de Tester',
  user_type: 'person',
};

export const homeZaken: ZaakSummary[] = [
  {
    identifier: 'Z/24/001',
    internal_id: 'zaak/abc-123-456',
    registratiedatum: new Date('2024-01-15'),
    verwachtte_einddatum: new Date('2024-06-01'),
    zaak_type: 'Gehandicaptenparkeerkaart aanvragen',
    zaak_identifier: 'Gehandicaptenparkeerkaart aanvragen',
    status: 'in behandeling',
  },
  {
    identifier: 'Z/24/002',
    internal_id: 'zaak/def-456-789',
    registratiedatum: new Date('2024-02-10'),
    einddatum: new Date('2024-03-01'),
    zaak_type: 'Bijstandsuitkering aanvragen',
    zaak_identifier: 'Bijstandsuitkering aanvragen',
    status: 'afgehandeld',
    resultaat: 'toegekend',
  },
];

export const homeTaken: TaakSummary[] = [
  {
    title: 'Aanvullende documenten aanleveren',
    url: 'https://example.com/taken/preview-1',
    uuid: 'task-preview-1',
    einddatum: '1 april 2024',
    is_open: true,
    is_afgerond: false,
    is_verwerkt: false,
    is_gesloten: false,
    laatstBewerktOp: new Date('2024-03-10').toISOString(),
  },
];
