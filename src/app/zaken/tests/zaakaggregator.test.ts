import { Bsn } from '@gemeentenijmegen/utils';
import axios from 'axios';
import { Inzendingen } from '../Inzendingen';
import { OpenZaakClient } from '../OpenZaakClient';
import { Person } from '../User';
import { ZaakAggregator } from '../ZaakAggregator';
import { ZaakSummary } from '../ZaakConnector';
import { Zaken } from '../Zaken';

const sampleDate = new Date();
const mockedZakenList: ZaakSummary[] = [
  {
    identifier: '123',
    internal_id: 'zaak/hiereenuuid',
    registratiedatum: sampleDate,
    verwachtte_einddatum: sampleDate,
    uiterlijke_einddatum: sampleDate,
    einddatum: sampleDate,
    zaak_type: 'zaaktype1',
    status: 'open',
    resultaat: 'geen',
  },
];

const mockedInzendingenList: ZaakSummary[] = [
  {
    identifier: '234',
    internal_id: 'inzending/234',
    registratiedatum: sampleDate,
    zaak_type: 'inzending',
    status: 'ontvangen',
  },
];

const mockedAggregatedZaken = [
  {
    identifier: '123',
    internal_id: 'zaak/hiereenuuid',
    registratiedatum: sampleDate,
    verwachtte_einddatum: sampleDate,
    uiterlijke_einddatum: sampleDate,
    einddatum: sampleDate,
    zaak_type: 'zaaktype1',
    status: 'open',
    resultaat: 'geen',
  },
  {
    identifier: '234',
    internal_id: 'inzending/234',
    registratiedatum: sampleDate,
    zaak_type: 'inzending',
    status: 'ontvangen',
  },
];

jest.mock('../Zaken', () => {
  return {
    Zaken: jest.fn(() => {
      return {
        list: jest.fn().mockResolvedValue(mockedZakenList),
      };
    }),
  };
});

jest.mock('../Inzendingen', () => {
  return {
    Inzendingen: jest.fn(() => {
      return {
        list: jest.fn().mockResolvedValue(mockedInzendingenList),
      };
    }),
  };
});

let baseUrl = new URL('http://localhost');
const person = new Person(new Bsn('900222670'), 'test', 'token');
const client = new OpenZaakClient({ baseUrl, axiosInstance: axios });
const inzendingen = new Inzendingen({ baseUrl: 'https://example.com', accessKey: 'test-access-key' });
const zaken = new Zaken(client, { zaakConnectorId: 'test' });
describe('Zaakaggregator returns combined zaken', () => {
  test('Zaakaggregator results in summaries useful for listing', async() => {
    const aggregator = new ZaakAggregator({
      zaakConnectors: {
        openzaak: zaken,
        inzendingen: inzendingen,
      },
    });
    expect(await aggregator.list(person)).toStrictEqual(mockedAggregatedZaken);
  });
});
