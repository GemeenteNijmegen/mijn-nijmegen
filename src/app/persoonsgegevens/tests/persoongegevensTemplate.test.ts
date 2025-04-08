import * as fs from 'fs';
import path from 'path';
import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { PersoonsgegevensRequestHandler } from '../persoonsgegevensRequestHandler';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { PersoonsgegevensMapper } from '../Persoonsgegevens';
import { HaalCentraalApi } from '../../../shared/HaalCentraalApi';


beforeAll(() => {
  if (process.env.VERBOSETESTS !== 'True') {
    global.console.error = jest.fn();
    global.console.time = jest.fn();
    // global.console.log = jest.fn();
  }
  // Mock isloggedin session
  process.env.SESSION_TABLE = 'mijnuitkering-sessions';
  process.env.APPLICATION_URL_BASE = 'https://testing.example.com/';

  // Zorg dat de output-map bestaat (deze is gitignored)
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
});

const ddbMock = mockClient(DynamoDBClient);

beforeEach(() => {
  ddbMock.reset();
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: true },
          identifier: { S: '900222670' },
          bsn: { S: '900222670' },
          user_type: { S: 'person' },
          state: { S: '12345' },
          username: { S: 'Jan de Tester' },
        },
      },
    },
  };
  ddbMock.on(GetItemCommand).resolves(getItemOutput);
  jest.restoreAllMocks();
});

/**
 * Hulpfunctie die een PersoonsgegevensRequestHandler returned met een fake HaalCentraal API.
 * De fake API levert de meegegeven data als resultaat van de getBrpData-aanroep.
 *
 * @param fakeHaalCentraalData - De data die de HaalCentraal API retourneert.
 */
function createHandler(fakeHaalCentraalData: any): PersoonsgegevensRequestHandler {
  const fakeHaalCentraalApi: Partial<HaalCentraalApi> = {
    getBrpData: jest.fn().mockResolvedValue(fakeHaalCentraalData),
  };

  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const dummyApiClient = {} as ApiClient;
  return new PersoonsgegevensRequestHandler({
    apiClient: dummyApiClient,
    dynamoDBClient,
    haalCentraalApi: fakeHaalCentraalApi as HaalCentraalApi,
  });
}

test('Persoonsgegevens volledige HC data', async () => {
  const fakeHaalCentraalData = {
    burgerservicenummer: '987654321',
    naam: {
        voornamen: 'Voor Namen',
        voorvoegsel: 'VoorVoegsel',
        geslachtsnaam: 'Geslachtsnaam',
    },
    adressering: { 
      aanschrijfwijze: { naam: 'Happyflow Data Aanschrijfwijze' },
    },
    geslacht: { code:'M'},
    nationaliteiten: [{ nationaliteit: { code: 'NL' } }],
    geboorte: { datum: { langFormaat: '1985-12-12' } },
    verblijfplaats: { 
      verblijfadres: {
        officieleStraatnaam: 'Teststraat',
        huisnummer: '1',
        postcode: '1234AB',
        woonplaats: 'Nijmegen'
      }
    },
  };


  const mapperSpy = jest.spyOn(PersoonsgegevensMapper, 'fromHaalCentraal');
  const logSpy = jest.spyOn(global.console, 'log');
  
  const handler = createHandler(fakeHaalCentraalData);
  const result = await handler.handleRequest('session=12345');

  expect((handler as any).config.haalCentraalApi.getBrpData).toHaveBeenCalled();
  expect(mapperSpy).toHaveBeenCalledWith(fakeHaalCentraalData);
  expect(result.statusCode).toBe(200);

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const outputFilename = path.join(__dirname, 'output', `persoonsgegevens_volledige_hc_data_${timestamp}.html`);
  fs.writeFileSync(outputFilename, result.body ? result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static') : '');
  // Should not trigger, if it does, it gives an empty page
  const errorFound = logSpy.mock.calls.some(call =>
    call.some(arg => String(arg).includes('TypeError: Cannot read properties of undefined'))
  );
  expect(errorFound).toBe(false);
  expect(result.body).not.toMatch('<h2>Er is iets misgegaan</h2>');
});

test('Persoonsgegevens template undefined data', async () => {
  const fakeHaalCentraalData = {
    burgerservicenummer: '987654321',
    naam: undefined,
    adressering: undefined,
    geslacht: undefined,
    nationaliteiten: undefined,
    geboorte: undefined,
    verblijfplaats: undefined,
  };

  const logSpy = jest.spyOn(global.console, 'log');
  const mapperSpy = jest.spyOn(PersoonsgegevensMapper, 'fromHaalCentraal');
  const handler = createHandler(fakeHaalCentraalData);
  const result = await handler.handleRequest('session=12345');


  expect((handler as any).config.haalCentraalApi.getBrpData).toHaveBeenCalled();
  expect(mapperSpy).toHaveBeenCalledWith(fakeHaalCentraalData);
  expect(result.statusCode).toBe(200);

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const outputFilename = path.join(__dirname, 'output', `persoonsgegevens_undefined_data_${timestamp}.html`);
  fs.writeFileSync(outputFilename, result.body ? result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static') : '');
  // Should not trigger, if it does, it gives an empty page
  const errorFound = logSpy.mock.calls.some(call =>
    call.some(arg => String(arg).includes('TypeError: Cannot read properties of undefined'))
  );
  expect(errorFound).toBe(false);
  expect(result.body).not.toMatch('<h2>Er is iets misgegaan</h2>');
});

test('Persoonsgegevens template bsn undefined should give errorpage', async () => {
  // All data could be undefined for some reason, however, bsn is the minimum expectation.
  const fakeHaalCentraalData = {
    burgerservicenummer: undefined,
    naam: undefined,
    adressering: undefined,
    geslacht: undefined,
    nationaliteiten: undefined,
    geboorte: undefined,
    verblijfplaats: undefined,
  };

  const logSpy = jest.spyOn(global.console, 'log');
  const mapperSpy = jest.spyOn(PersoonsgegevensMapper, 'fromHaalCentraal');
  const handler = createHandler(fakeHaalCentraalData);
  const result = await handler.handleRequest('session=12345');


  expect((handler as any).config.haalCentraalApi.getBrpData).toHaveBeenCalled();
  expect(mapperSpy).toHaveBeenCalledWith(fakeHaalCentraalData);
  expect(result.statusCode).toBe(200);

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const outputFilename = path.join(__dirname, 'output', `persoonsgegevens_undefined_data_${timestamp}.html`);
  fs.writeFileSync(outputFilename, result.body ? result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static') : '');
  // Should not trigger, if it does, it gives an empty page
  const errorFound = logSpy.mock.calls.some(call =>
    call.some(arg => String(arg).includes('TypeError: Cannot read properties of undefined'))
  );
  expect(errorFound).toBe(true);
  expect(result.body).toMatch('<h2>Er is iets misgegaan</h2>');
});