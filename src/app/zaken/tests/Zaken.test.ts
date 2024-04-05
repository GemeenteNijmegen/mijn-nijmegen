import { Bsn } from '@gemeentenijmegen/utils';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import catalogi from './samples/catalogi.json';
import enkelvoudiginformatiobject from './samples/enkelvoudiginformatieobject.json';
import resultaattypen from './samples/resultaattypen.json';
import resultaatvoorbeeld from './samples/resultaatvoorbeeld.json';
import rol from './samples/rol.json';
import statustypen from './samples/statustypen.json';
import statusvoorbeeld from './samples/statusvoorbeeld.json';
import statusvoorbeeld2 from './samples/statusvoorbeeld2.json';
import zaak1 from './samples/zaak1.json';
import zaak1noStatus from './samples/zaak1noStatus.json';
import zaakinformatieobjecten from './samples/zaakinformatieobjecten.json';
import zaaktypen from './samples/zaaktypen.json';
import zaken from './samples/zaken.json';
import { OpenZaakClient } from '../OpenZaakClient';
import { Person } from '../User';
import { Zaken } from '../Zaken';

let baseUrl = new URL('http://localhost');
if (process.env.VIP_BASE_URL) {
  baseUrl = new URL(process.env.VIP_BASE_URL);
}
const axiosMock = new MockAdapter(axios);

beforeAll(() => {
  axiosMock.onGet('/catalogi/api/v1/zaaktypen').reply(200, zaaktypen);
  axiosMock.onGet('/catalogi/api/v1/statustypen').reply(200, statustypen);
  axiosMock.onGet('/catalogi/api/v1/resultaattypen').reply(200, resultaattypen);
  axiosMock.onGet('/catalogi/api/v1/catalogussen').reply(200, catalogi);
  axiosMock.onGet(/\/zaken\/api\/v1\/zaken\?rol__betrokkeneIdentificatie__natuurlijkPersoon__inpBsn.*/).reply(200, zaken);
  axiosMock.onGet('/zaken/api/v1/zaken/5b1c4f8f-8c62-41ac-a3a0-e2ac08b6e886').reply(200, zaak1);
  axiosMock.onGet('/zaken/api/v1/zaken/noStatus').reply(200, zaak1noStatus);
  axiosMock.onGet('/zaken/api/v1/statussen/9f14d7b0-8f00-4827-9b99-d77ae5d8d155').reply(200, statusvoorbeeld);
  axiosMock.onGet(/\/zaken\/api\/v1\/statussen\/.+/).reply(200, statusvoorbeeld2);
  axiosMock.onGet(/\/zaken\/api\/v1\/resultaten\/.+/).reply(200, resultaatvoorbeeld);
  axiosMock.onGet(/\/zaken\/api\/v1\/rollen.+/).reply(200, rol);
  axiosMock.onGet(/\/zaken\/api\/v1\/zaakinformatieobjecten.+/).reply(200, zaakinformatieobjecten);
  axiosMock.onGet(/\/documenten\/api\/v1\/enkelvoudiginformatieobjecten.+/).reply(200, enkelvoudiginformatiobject);
});

describe('Zaken', () => {
  const person = new Person(new Bsn('900222670'));
  const client = new OpenZaakClient({ baseUrl, axiosInstance: axios });
  test('constructing object succeeds', async () => {
    axiosMock.onGet().reply(200, []);
    const zaakConnectorId = 'testzaak';
    expect(() => { new Zaken(client, { zaakConnectorId }); }).not.toThrow();
  });

  test('zaken are processed correctly', async () => {
    const zaakConnectorId = 'testzaak';
    const statusResults = new Zaken(client, { zaakConnectorId });
    const results = await statusResults.list(person);
    expect(results).toStrictEqual([
      {
        identifier: 'Z23.001592',
        registratiedatum: new Date('2023-06-09T00:00:00.000Z'),
        verwachtte_einddatum: new Date('2023-09-01T00:00:00.000Z'),
        einddatum: undefined,
        uiterlijke_einddatum: new Date('2023-10-11T00:00:00.000Z'),
        resultaat: null,
        status: 'In behandeling',
        internal_id: `${zaakConnectorId}/5b1c4f8f-8c62-41ac-a3a0-e2ac08b6e886`,
        zaak_type: 'Bezwaar',
      },
      {
        einddatum: undefined,
        identifier: 'Z23.001719',
        registratiedatum: new Date('2023-09-21T00:00:00.000Z'),
        resultaat: null,
        status: null,
        uiterlijke_einddatum: new Date('2024-09-20T00:00:00.000Z'),
        internal_id: `${zaakConnectorId}/30009319-395f-491f-be0e-24c0e0d04a75`,
        verwachtte_einddatum: new Date('2024-09-20T00:00:00.000Z'),
        zaak_type: 'Bingo',
      },
      {
        identifier: 'Z23.001438',
        registratiedatum: new Date('2023-03-30T00:00:00.000Z'),
        einddatum: new Date('2023-03-28T00:00:00.000Z'),
        verwachtte_einddatum: new Date('2023-06-20T00:00:00.000Z'),
        uiterlijke_einddatum: new Date('2023-06-11T00:00:00.000Z'),
        resultaat: 'Ingetrokken na BIA',
        status: 'In behandeling',
        internal_id: `${zaakConnectorId}/3720dbc1-6a94-411e-b651-0aeb67330064`,
        zaak_type: 'Klacht',
      },
    ]);
  });

  test('a single zaak is processed correctly',
    async () => {
      const zaakConnectorId = 'testzaak';
      const statusResults = new Zaken(client, { zaakConnectorId });
      const results = await statusResults.get('5b1c4f8f-8c62-41ac-a3a0-e2ac08b6e886', person);
      expect(results).toStrictEqual(
        {
          identifier: 'Z23.001592',
          registratiedatum: new Date('2023-06-09T00:00:00.000Z'),
          verwachtte_einddatum: new Date('2023-09-01T00:00:00.000Z'),
          einddatum: undefined,
          uiterlijke_einddatum: new Date('2023-10-11T00:00:00.000Z'),
          resultaat: null,
          status: 'In behandeling',
          internal_id: `${zaakConnectorId}/5b1c4f8f-8c62-41ac-a3a0-e2ac08b6e886`,
          zaak_type: 'Bezwaar',
          status_list: [
            {
              name: 'Ontvangen',
              current: false,
              completed: true,
              is_eind: false,
              volgnummer: 1,
            },
            {
              name: 'In behandeling',
              current: true,
              is_eind: false,
              completed: false,
              volgnummer: 2,
            },
            {
              name: 'Afgerond',
              current: false,
              completed: false,
              is_eind: true,
              volgnummer: 3,
            },
          ],
          documenten: [],
          taken: null,
          behandelaars: [],
          type: 'case',
        });
    });

  test('a single zaak has several statusses, which are available in the zaak', async () => {
    const zaakConnectorId = 'testzaak';
    const statusResults = new Zaken(client, { show_documents: true, zaakConnectorId });
    const results = await statusResults.get('5b1c4f8f-8c62-41ac-a3a0-e2ac08b6e886', person);
    expect(results).toStrictEqual({
      identifier: 'Z23.001592',
      registratiedatum: new Date('2023-06-09T00:00:00.000Z'),
      verwachtte_einddatum: new Date('2023-09-01T00:00:00.000Z'),
      uiterlijke_einddatum: new Date('2023-10-11T00:00:00.000Z'),
      einddatum: undefined,
      resultaat: null,
      status: 'In behandeling',
      status_list: [
        {
          name: 'Ontvangen',
          current: false,
          completed: true,
          is_eind: false,
          volgnummer: 1,
        },
        {
          name: 'In behandeling',
          current: true,
          completed: false,
          is_eind: false,
          volgnummer: 2,
        },
        {
          name: 'Afgerond',
          current: false,
          completed: false,
          is_eind: true,
          volgnummer: 3,
        },
      ],
      internal_id: `${zaakConnectorId}/5b1c4f8f-8c62-41ac-a3a0-e2ac08b6e886`,
      zaak_type: 'Bezwaar',
      documenten: [
        {
          beschrijving: '',
          registratieDatum: '2023-10-03T11:33:45.683874Z',
          titel: 'test docx',
          url: '/documenten/api/v1/enkelvoudiginformatieobjecten/634d7c96-9fe2-4dee-b389-fcd2c5beb2d0',
        },
        {
          beschrijving: '',
          registratieDatum: '2023-10-03T11:33:45.683874Z',
          titel: 'test docx',
          url: '/documenten/api/v1/enkelvoudiginformatieobjecten/634d7c96-9fe2-4dee-b389-fcd2c5beb2d0',
        },
      ],
      taken: null,
      behandelaars: [],
      type: 'case',
    });
  });

  test('a single zaak can have a null status', async () => {
    const zaakConnectorId = 'testzaak2';
    const statusResults = new Zaken(client, { zaakConnectorId });
    const results = await statusResults.get('noStatus', person);
    expect(results).toStrictEqual({
      identifier: 'Z23.001592',
      registratiedatum: new Date('2023-06-09T00:00:00.000Z'),
      verwachtte_einddatum: new Date('2023-09-01T00:00:00.000Z'),
      uiterlijke_einddatum: new Date('2023-10-11T00:00:00.000Z'),
      einddatum: undefined,
      resultaat: null,
      status: null,
      status_list: null,
      internal_id: `${zaakConnectorId}/5b1c4f8f-8c62-41ac-a3a0-e2ac08b6e886`,
      zaak_type: 'Bezwaar',
      documenten: [],
      taken: null,
      behandelaars: [],
      type: 'case',
    });
  });


  // test('list returns zaken', async () => {
  //   if(!process.env.VIP_JWT_SECRET) {
  //     console.debug('Secret must be provided for live test, skipping');
  //     return;
  //   }
  //   const client = new OpenZaakClient({
  //     baseUrl,
  //     clientId: process.env.VIP_JWT_CLIENT_ID,
  //     userId: process.env.VIP_JWT_USER_ID,
  //     secret: process.env.VIP_JWT_SECRET
  //   });
  //   const statuses  = new Statuses(client);
  //   const zaken = await statuses.list();
  //   console.debug(zaken);
  //   expect(zaken.length).toBeGreaterThanOrEqual(0);
  // });
});

describe('Filtering domains', () => {
  const person = new Person(new Bsn('900222670'));
  const client = new OpenZaakClient({ baseUrl, axiosInstance: axios });
  test('zaken are filtered (APV)', async () => {
    const zaakConnectorId = 'testzaak';
    const statusResults = new Zaken(client, { zaakConnectorId });
    statusResults.allowDomains(['APV']);
    const results = await statusResults.list(person);
    expect(results).toStrictEqual([{
      einddatum: undefined,
      identifier: 'Z23.001719',
      registratiedatum: new Date('2023-09-21T00:00:00.000Z'),
      resultaat: null,
      status: null,
      uiterlijke_einddatum: new Date('2024-09-20T00:00:00.000Z'),
      internal_id: `${zaakConnectorId}/30009319-395f-491f-be0e-24c0e0d04a75`,
      verwachtte_einddatum: new Date('2024-09-20T00:00:00.000Z'),
      zaak_type: 'Bingo',
    }]);
  });

  test('zaken are filtered (JZ)', async () => {
    const zaakConnectorId = 'testzaak';
    const statusResults = new Zaken(client, { zaakConnectorId });
    statusResults.allowDomains(['JZ']);
    const results = await statusResults.list(person);
    expect(results).toStrictEqual([
      {
        identifier: 'Z23.001592',
        registratiedatum: new Date('2023-06-09T00:00:00.000Z'),
        verwachtte_einddatum: new Date('2023-09-01T00:00:00.000Z'),
        einddatum: undefined,
        uiterlijke_einddatum: new Date('2023-10-11T00:00:00.000Z'),
        resultaat: null,
        status: 'In behandeling',
        internal_id: `${zaakConnectorId}/5b1c4f8f-8c62-41ac-a3a0-e2ac08b6e886`,
        zaak_type: 'Bezwaar',
      },
      {
        identifier: 'Z23.001438',
        registratiedatum: new Date('2023-03-30T00:00:00.000Z'),
        einddatum: new Date('2023-03-28T00:00:00.000Z'),
        verwachtte_einddatum: new Date('2023-06-20T00:00:00.000Z'),
        uiterlijke_einddatum: new Date('2023-06-11T00:00:00.000Z'),
        resultaat: 'Ingetrokken na BIA',
        status: 'In behandeling',
        internal_id: `${zaakConnectorId}/3720dbc1-6a94-411e-b651-0aeb67330064`,
        zaak_type: 'Klacht',
      },
    ]);
  });

  test('a single zaak is processed correctly',
    async () => {
      const zaakConnectorId = 'testzaak';
      const statusResults = new Zaken(client, { zaakConnectorId });
      statusResults.allowDomains(['JZ']);
      const results = await statusResults.get('5b1c4f8f-8c62-41ac-a3a0-e2ac08b6e886', person);
      expect(results).toStrictEqual(
        {
          identifier: 'Z23.001592',
          registratiedatum: new Date('2023-06-09T00:00:00.000Z'),
          verwachtte_einddatum: new Date('2023-09-01T00:00:00.000Z'),
          einddatum: undefined,
          uiterlijke_einddatum: new Date('2023-10-11T00:00:00.000Z'),
          resultaat: null,
          status: 'In behandeling',
          internal_id: `${zaakConnectorId}/5b1c4f8f-8c62-41ac-a3a0-e2ac08b6e886`,
          zaak_type: 'Bezwaar',
          status_list: [
            {
              name: 'Ontvangen',
              current: false,
              is_eind: false,
              completed: true,
              volgnummer: 1,
            },
            {
              name: 'In behandeling',
              current: true,
              is_eind: false,
              completed: false,
              volgnummer: 2,
            },
            {
              name: 'Afgerond',
              current: false,
              is_eind: true,
              completed: false,
              volgnummer: 3,
            },
          ],
          documenten: [],
          taken: null,
          behandelaars: [],
          type: 'case',
        });
    });
  test('a single zaak is filtered correctly (APV)',
    async () => {
      const zaakConnectorId = 'testzaak';
      const statusResults = new Zaken(client, { zaakConnectorId });
      statusResults.allowDomains(['APV']);
      const results = await statusResults.get('5b1c4f8f-8c62-41ac-a3a0-e2ac08b6e886', person);
      expect(results).toBeFalsy();
    });
});
