import { ZaakSummary, SingleZaak } from '../../app/zaken/ZaakInterface';

export const zakenList: ZaakSummary[] = [
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
  {
    identifier: 'INZ/24/001',
    internal_id: 'inzending/ghi-789-012',
    registratiedatum: new Date('2024-03-01'),
    zaak_type: 'inzending',
    zaak_identifier: 'Formulier ingediend',
    status: 'ontvangen',
  },
];

export const singleZaak: SingleZaak = {
  identifier: 'Z/24/001',
  internal_id: 'zaak/abc-123-456',
  registratiedatum: new Date('2024-01-15'),
  verwachtte_einddatum: new Date('2024-06-01'),
  zaak_type: 'Gehandicaptenparkeerkaart aanvragen',
  zaak_identifier: 'Gehandicaptenparkeerkaart aanvragen',
  status: 'in behandeling',
  status_list: [
    { volgnummer: 1, name: 'Aanvraag ontvangen', completed: true, current: false },
    { volgnummer: 2, name: 'In behandeling', completed: false, current: true },
    { volgnummer: 3, name: 'Beslissing', completed: false, current: false, is_eind: true },
  ],
  behandelaars: ['Jan Jansen'],
  type: 'case',
  documenten: [
    { titel: 'Aanvraagformulier.pdf', url: 'aanvraagformulier.pdf' },
  ],
  taken: [],
};
