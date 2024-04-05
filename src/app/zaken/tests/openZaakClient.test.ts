import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { OpenZaakClient } from '../OpenZaakClient';

dotenv.config();


const statusTypenPage1 =
{
  count: 2,
  next: '/catalogi/api/v1/statustypen?page=2',
  previous: null,
  results: [
    {
      url: '/catalogi/api/v1/statustypen/4ea07bd7-4cea-4417-b355-36747e9d3ae0',
      omschrijving: 'Zaak afgerond',
      omschrijvingGeneriek: '',
      statustekst: '',
      zaaktype: '/catalogi/api/v1/zaaktypen/a9f5bf26-2664-44ed-b47e-9fe99971b2c2',
      volgnummer: 3,
      isEindstatus: true,
      informeren: false,
    },
    {
      url: '/catalogi/api/v1/statustypen/24849276-7e5a-40dd-bd40-f475c35d4167',
      omschrijving: 'In behandeling',
      omschrijvingGeneriek: '',
      statustekst: '',
      zaaktype: '/catalogi/api/v1/zaaktypen/a9f5bf26-2664-44ed-b47e-9fe99971b2c2',
      volgnummer: 2,
      isEindstatus: false,
      informeren: false,
    },
  ],
};


const statusTypenPage2 =
{
  count: 2,
  next: '/catalogi/api/v1/statustypen?page=3',
  previous: '/catalogi/api/v1/statustypen?page=1',
  results: [
    {
      url: '/catalogi/api/v1/statustypen/39395d88-1024-433b-80c6-cdf37161426f',
      omschrijving: 'Ontvangenpage2',
      omschrijvingGeneriek: '',
      statustekst: '',
      zaaktype: '/catalogi/api/v1/zaaktypen/a9f5bf26-2664-44ed-b47e-9fe99971b2c2',
      volgnummer: 1,
      isEindstatus: false,
      informeren: false,
    },
    {
      url: '/catalogi/api/v1/statustypen/bb8e737d-df72-44f0-bb18-7cb4bc0daa0b',
      omschrijving: 'Zaak afgerondpage2',
      omschrijvingGeneriek: '',
      statustekst: '',
      zaaktype: '/catalogi/api/v1/zaaktypen/559caaac-7b9e-43f9-a56a-ad439cfb459a',
      volgnummer: 3,
      isEindstatus: true,
      informeren: false,
    },
  ],
};

const statusTypenPage3 =
{
  count: 2,
  next: null,
  previous: '/catalogi/api/v1/statustypen?page=2',
  results: [
    {
      url: '/catalogi/api/v1/statustypen/39395d88-1024-433b-80c6-cdf37161426f',
      omschrijving: 'Ontvangenpage3',
      omschrijvingGeneriek: '',
      statustekst: '',
      zaaktype: '/catalogi/api/v1/zaaktypen/a9f5bf26-2664-44ed-b47e-9fe99971b2c2',
      volgnummer: 1,
      isEindstatus: false,
      informeren: false,
    },
    {
      url: '/catalogi/api/v1/statustypen/bb8e737d-df72-44f0-bb18-7cb4bc0daa0b',
      omschrijving: 'Zaak afgerondpage3',
      omschrijvingGeneriek: '',
      statustekst: '',
      zaaktype: '/catalogi/api/v1/zaaktypen/559caaac-7b9e-43f9-a56a-ad439cfb459a',
      volgnummer: 3,
      isEindstatus: true,
      informeren: false,
    },
  ],
};


const secret = process.env.VIP_JWT_SECRET;
let baseUrl = new URL('http://localhost');
if (process.env.VIP_BASE_URL) {
  baseUrl = new URL(process.env.VIP_BASE_URL);
}

describe('Openzaak Client', () => {
  test('does successful live requests with provided instance', async () => {
    if (!secret) {
      console.debug('Secret must be provided for live test, skipping');
      return;
    }
    const token = jwt.sign({
      iss: process.env.VIP_JWT_CLIENT_ID,
      iat: Date.now(),
      client_id: process.env.VIP_JWT_CLIENT_ID,
      user_id: process.env.VIP_JWT_USER_ID,
      user_representation: process.env.VIP_JWT_USER_ID,
    }, secret);

    const axiosInstance = axios.create(
      {
        baseURL: baseUrl.toString(),
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept-Crs': 'EPSG:4326',
          'Content-Crs': 'EPSG:4326',
        },
      });
    const client = new OpenZaakClient({ baseUrl, axiosInstance });

    const res = await client.request('/catalogi/api/v1/zaaktypen');
    expect(res).toHaveProperty('results');
  });
  test('does successful live requests with provided config', async () => {
    if (!secret) {
      console.debug('Secret must be provided for live test, skipping');
      return;
    }
    const client = new OpenZaakClient({ baseUrl, clientId: process.env.VIP_JWT_CLIENT_ID, userId: process.env.VIP_JWT_USER_ID, secret });
    const res = await client.request('/catalogi/api/v1/zaaktypen');
    expect(res).toHaveProperty('results');
  });

  test('not providing an instance or config throws', async () => {
    expect(() => {
      new OpenZaakClient({ baseUrl });
    }).toThrow();
  });

  test('providing config does not throw', async () => {
    expect(() => {
      new OpenZaakClient({ baseUrl, clientId: 'test', userId: 'testUser', secret: 'demoSecret' });
    }).not.toThrow();
  });

  /**
   * Be careful, the provided instance in this test is not usable to actually do API calls.
   */
  test('providing axios object does not throw', async () => {
    expect(() => {
      const axiosInstance = axios.create(
        {
          baseURL: 'process.env.VIP_BASE_URL',
        });
      new OpenZaakClient({ baseUrl, axiosInstance });
    }).not.toThrow();
  });
});

describe('pagination tests', () => {
  test('Statustypen with two pages', async () => {
    const axiosInstance = axios.create(
      {
        baseURL: 'process.env.VIP_BASE_URL',
      });
    const axiosMock = new MockAdapter(axiosInstance);
    axiosMock.onGet('/catalogi/api/v1/statustypen').reply(200, statusTypenPage1);
    axiosMock.onGet('/catalogi/api/v1/statustypen?page=2').reply(200, statusTypenPage2);
    axiosMock.onGet('/catalogi/api/v1/statustypen?page=3').reply(200, statusTypenPage3);

    const client = new OpenZaakClient({ baseUrl, axiosInstance });
    const statustypen = await client.request('/catalogi/api/v1/statustypen');
    expect(statustypen.results).toHaveLength(6);
  });
});
