import { randomUUID } from 'crypto';
import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { User } from '../../zaken/User';
import { ContactgegevensRequestHandler } from '../ContactgegevensRequestHandler';
import { OpenKlantPartijWithUuid } from '../model/partij';
import { IOpenKlantAPI, OpenKlantAPIMock } from '../OpenKlantApi';

const ddbMock = mockClient(DynamoDBClient);
const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });

const xsrf_token = randomUUID();
const exampleEmail = 'test@example.com';
const examplePhone = '+31612121123';

describe('Contactgegevens handler', () => {

  test('Initalization', () => {
    const handler = getHandler();
    expect(handler).toBeDefined();
  });

  test('handle post', async () => {
    setupSessionResponse(true);
    const handler = getHandler();
    const response = await handler.handleRequest({
      cookies: 'session=123;',
      method: 'POST',
      email: 'test@example.com',
      telefoonnummer: examplePhone,
      xsrf_token: xsrf_token,
    });
    expect(handler.config.openKlantApi.getPartijWithDigitaleAdresen).toHaveBeenCalledTimes(1);
    expect(handler.config.openKlantApi.createNatuurlijkPersoon).toHaveBeenCalledTimes(0);
    expect(handler.config.openKlantApi.addPartijIdentificatie).toHaveBeenCalledTimes(0);
    expect(handler.config.openKlantApi.updateDigitaalAdress).toHaveBeenCalledTimes(2);
    expect(response.statusCode).toBe(302);
  });

  test('handle invalid phone number', async () => {
    setupSessionResponse(true);
    const handler = getHandler();
    const response = handler.handleRequest({
      cookies: 'session=123;',
      method: 'POST',
      email: undefined,
      telefoonnummer: 'abc',
      xsrf_token: xsrf_token,
    });
    await expect(response).rejects.toThrow('Invalid telefoonnummer');
  });

  test('handle invalid email', async () => {
    setupSessionResponse(true);
    const handler = getHandler();
    const response = handler.handleRequest({
      cookies: 'session=123;',
      method: 'POST',
      email: 'test@example',
      telefoonnummer: undefined,
      xsrf_token: xsrf_token,
    });
    await expect(response).rejects.toThrow('Invalid email');
  });

  test('handle no existing party post', async () => {
    setupSessionResponse(true);
    const handler = getHandler(mockOpenKlantApi({
      partijNotFound: true,
    }));
    const response = await handler.handleRequest({
      cookies: 'session=123;',
      method: 'POST',
      email: 'test@example.com',
      telefoonnummer: examplePhone,
      xsrf_token: xsrf_token,
    });
    expect(handler.config.openKlantApi.getPartijWithDigitaleAdresen).toHaveBeenCalledTimes(1);
    expect(handler.config.openKlantApi.createNatuurlijkPersoon).toHaveBeenCalledTimes(1);
    expect(handler.config.openKlantApi.addPartijIdentificatie).toHaveBeenCalledTimes(1);
    expect(handler.config.openKlantApi.createDigitaalAdress).toHaveBeenCalledTimes(2);
    expect(response.statusCode).toBe(302);
  });

  test('mismach xsrf token on post', async () => {
    setupSessionResponse(true);
    const handler = getHandler();
    const response = handler.handleRequest({
      cookies: 'session=123;',
      method: 'POST',
      email: 'test@example.com',
      telefoonnummer: examplePhone,
      xsrf_token: 'abc',
    });
    await expect(response).rejects.toThrow('xsrf_token mismatch!');
  });

  test('handle get', async () => {
    setupSessionResponse(true);
    const handler = getHandler();
    const response = await handler.handleRequest({
      cookies: 'session=123;',
      method: 'GET',
    });
    expect(response.statusCode).toBe(200);
  });

  test('prefill data if partij found', async () => {
    setupSessionResponse(true);
    const handler = getHandler();
    const response = await handler.handleRequest({
      cookies: 'session=123;',
      method: 'GET',
    });
    expect(response.body).toMatch(exampleEmail);
    expect(response.body).toMatch(examplePhone);
    expect(response.statusCode).toBe(200);
  });

  test('handle partij not found renders form', async () => {
    setupSessionResponse(true);
    const handler = getHandler(mockOpenKlantApi({ partijNotFound: true }));
    const response = await handler.handleRequest({
      cookies: 'session=123;',
      method: 'GET',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatch('</form>');
  });

  test('check if xsrf token is included', async () => {
    setupSessionResponse(true);
    const handler = getHandler(mockOpenKlantApi({ partijNotFound: true }));
    const response = await handler.handleRequest({
      cookies: 'session=123;',
      method: 'GET',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatch(xsrf_token);
  });


});

function getHandler(openKlantApi?: IOpenKlantAPI) {
  const handler = new ContactgegevensRequestHandler({
    dynamoDBClient,
    openKlantApi: openKlantApi ?? mockOpenKlantApi({}),
  });
  return handler;
}


function mockOpenKlantApi(config: {
  partijNotFound?: boolean;
  includeDigitaleAdressen?: boolean;
}) {
  const openKlantApiMock = new OpenKlantAPIMock();
  const appendUuid = (obj: any) => Promise.resolve({ uuid: randomUUID(), ...obj });
  jest.spyOn(openKlantApiMock, 'createNatuurlijkPersoon').mockImplementation(async () => {
    return {
      uuid: randomUUID(),
      indicatieActief: true,
      soortPartij: 'persoon',
      voorkeurstaal: 'dut',
      digitaleAdressen: [],
      indicatieGeheimhouding: false,
      rekeningnummers: [],
      voorkeursDigitaalAdres: null,
      voorkeursRekeningnummer: null,
    } as OpenKlantPartijWithUuid;
  });
  jest.spyOn(openKlantApiMock, 'addPartijIdentificatie').mockImplementation(appendUuid);
  jest.spyOn(openKlantApiMock, 'createDigitaalAdress').mockImplementation(appendUuid);
  jest.spyOn(openKlantApiMock, 'updateDigitaalAdress').mockImplementation(appendUuid);
  jest.spyOn(openKlantApiMock, 'deleteDigitaalAdress').mockImplementation(jest.fn());
  jest.spyOn(openKlantApiMock, 'getPartijWithDigitaleAdresen').mockImplementation(async (user: User) => {
    if (config.partijNotFound) {
      return undefined as unknown as OpenKlantPartijWithUuid; // Type hacking i dont know why
    }
    const partij: OpenKlantPartijWithUuid = {
      uuid: randomUUID(),
      indicatieActief: true,
      soortPartij: 'persoon',
      voorkeurstaal: 'dut',
      digitaleAdressen: [],
      indicatieGeheimhouding: false,
      rekeningnummers: [],
      voorkeursDigitaalAdres: null,
      voorkeursRekeningnummer: null,
      partijIdentificatie: {
        naam: user.userName ?? 'username',
        volledigeNaam: user.userName ?? 'username',
        contactnaam: null,
      },
      _expand: {
        digitaleAdressen: [
          {
            adres: exampleEmail,
            omschrijving: 'email',
            soortDigitaalAdres: 'email',
            uuid: randomUUID(),
            url: 'https://example.com',
          },
          {
            adres: examplePhone,
            omschrijving: 'telefoonnummer',
            soortDigitaalAdres: 'telefoonnummer',
            uuid: randomUUID(),
            url: 'https://example.com',
          },
        ],
      },
    };
    return partij;
  });
  return openKlantApiMock;
}


function setupSessionResponse(loggedin: boolean) {
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: loggedin },
          identifier: { S: '900026236' },
          state: { S: 'state' },
          user_type: { S: 'person' },
          username: { S: 'username' },
          xsrf_token: { S: xsrf_token },
        },
      },
    },
  };
  ddbMock.on(GetItemCommand).resolves(getItemOutput);
}
