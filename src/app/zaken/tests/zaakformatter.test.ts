import { SingleZaak } from '../ZaakConnector';
import { ZaakFormatter } from '../ZaakFormatter';

describe('Zaakformatter can format single zaak', () => {
  test('Sorting behandelaars works', async () => {
    const zaak: SingleZaak = {
      identifier: 'Z23.001592',
      registratiedatum: new Date('2023-06-09T00:00:00.000Z'),
      verwachtte_einddatum: new Date('2023-09-01T00:00:00.000Z'),
      uiterlijke_einddatum: new Date('2023-10-11T00:00:00.000Z'),
      einddatum: undefined,
      resultaat: undefined,
      status: 'test',
      status_list: undefined,
      internal_id: 'test/5b1c4f8f-8c62-41ac-a3a0-e2ac08b6e886',
      zaak_type: 'Bezwaar',
      documenten: [],
      taken: undefined,
      behandelaars: ['Piet Pietersen', 'Antoon Andriessen'],
      type: 'case',
    };

    expect(new ZaakFormatter().formatZaak(zaak).behandelaars).toBe('Antoon Andriessen, Piet Pietersen');
  });
});

describe('Zaakformatter can format lists', () => {
  const zaken = [
    {
      identifier: 'TDL28.627',
      internal_id: 'inzendingen/TDL28.627',
      registratiedatum: new Date('2024-08-06T09:47:01.000Z'),
      zaak_type: 'test',
      status: 'Ontvangen',
    },
  ];
  const zaakSummaries = new ZaakFormatter().formatList(zaken);
  expect(zaakSummaries).toBeTruthy();
});
