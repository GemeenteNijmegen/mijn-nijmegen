import { TaakSummary } from '../../app/zaken/ZaakInterface';

export const takenData: TaakSummary[] = [
  {
    title: 'Aanvullende documenten aanleveren voor uw aanvraag',
    url: 'https://example.com/taken/preview-1',
    uuid: 'task-preview-1',
    einddatum: '1 april 2024',
    is_open: true,
    is_afgerond: false,
    is_verwerkt: false,
    is_gesloten: false,
    laatstBewerktOp: new Date('2024-03-10').toISOString(),
  },
  {
    title: 'Inkomensverklaring uploaden',
    url: 'https://example.com/taken/preview-2',
    uuid: 'task-preview-2',
    einddatum: '15 april 2024',
    is_open: true,
    is_afgerond: false,
    is_verwerkt: false,
    is_gesloten: false,
    laatstBewerktOp: new Date('2024-03-12').toISOString(),
  },
];
