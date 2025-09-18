import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { ContactgegevensService } from '../ContactgegevensService';
import { OpenKlantAPIMock } from '../OpenKlantApi';
import { RenderingService } from '../RenderingService';
import { Config, ContactgegevensRequestHandler, RequestParameters } from '../RequestHandler';
import { RequestValidator } from '../Validator';
import { NotifyNlVerificationService } from '../VerificationService';

jest.mock('../ContactgegevensService');
jest.mock('../VerificationService');
jest.mock('../RenderingService');
jest.mock('../Validator');

const ddbMock = mockClient(DynamoDBClient);
const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });

describe('ContactgegevensRequestHandler', () => {
  let handler: ContactgegevensRequestHandler;
  let config: Config;

  beforeEach(() => {
    config = {
      dynamoDBClient,
      contactgegevens: new ContactgegevensService(new OpenKlantAPIMock()) as jest.Mocked<ContactgegevensService>,
      verification: new NotifyNlVerificationService({
        baseUrl: '',
        notifyIssuer: 'notifyIssuer',
        emailTemplate: '',
        notifySecret: '',
        smsTemplate: '',
      }) as jest.Mocked<NotifyNlVerificationService>,
    };
    handler = new ContactgegevensRequestHandler(config, console as any);
  });

  it('should redirect to login if not logged in', async () => {
    setupSessionResponse(false);
    const params: RequestParameters = {
      cookies: 'session=abc',
      method: 'GET',
    };
    const response = await handler.handleRequest(params);
    expect(response).toEqual(expect.objectContaining({
      statusCode: 302,
      headers: expect.objectContaining({ Location: '/login' }),
    }));
  });

  it('should handle GET request to /edit', async () => {
    setupSessionResponse(true);
    const params: RequestParameters = {
      cookies: 'session=abc',
      method: 'GET',
      path: 'edit',
    };
    (RenderingService.prototype.renderEdit as jest.Mock).mockResolvedValue('mockedHTML');
    const response = await handler.handleRequest(params);
    expect(response).toEqual(expect.objectContaining({
      statusCode: 200,
      body: 'mockedHTML',
    }));
  });

  it('should handle POST request to /edit', async () => {
    setupSessionResponse(true);
    const params: RequestParameters = {
      cookies: 'session=abc',
      method: 'POST',
      path: 'edit',
      email: 'test@example.com',
      xsrf_token: 'abcdef',
    };
    (RenderingService.prototype.renderEdit as jest.Mock).mockResolvedValue('mockedHTML');
    (NotifyNlVerificationService.prototype.startVerification as jest.Mock).mockResolvedValue(undefined);
    (RequestValidator.validate as jest.Mock).mockReturnValue([]);
    const response = await handler.handleRequest(params);
    expect(response).toEqual(expect.objectContaining({
      statusCode: 302,
      headers: expect.objectContaining({ Location: '/contactgegevens/verify' }),
    }));
  });

  it('should handle verification POST request', async () => {
    setupSessionResponse(true, {
      emailToBe: 'test@example.com',
    });
    const params: RequestParameters = {
      cookies: 'session=abc',
      method: 'POST',
      path: 'verify',
      xsrf_token: 'abcdef',
      verificationCode: 'validCode',
    };
    (NotifyNlVerificationService.prototype.checkVerification as jest.Mock).mockResolvedValue({ verified: true });
    (ContactgegevensService.prototype.updateContactgegevensNatuurlijkPersoon as jest.Mock).mockResolvedValue(undefined);
    const response = await handler.handleRequest(params);
    expect(response).toEqual(expect.objectContaining({
      statusCode: 302,
      headers: expect.objectContaining({ Location: '/contactgegevens' }),
    }));
  });

  it('should handle XSRF token mismatch', async () => {
    setupSessionResponse(true);
    const params: RequestParameters = {
      cookies: 'session=12345',
      method: 'POST',
      path: 'edit',
      xsrf_token: 'xxxxxx', // Mismatch from session
    };
    await expect(handler.handleRequest(params)).rejects.toThrow('xsrf_token mismatch!');
  });

});


function setupSessionResponse(loggedin: boolean, otherData?: Record<string, string>) {

  let otherDataMock: any = {};
  Object.entries(otherData ?? {}).forEach(([key, value]) => {
    otherDataMock[key] = { S: value };
  });

  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: loggedin },
          identifier: { S: '900026236' },
          state: { S: 'state' },
          user_type: { S: 'person' },
          username: { S: 'username' },
          xsrf_token: { S: 'abcdef' },
          ...otherDataMock,
        },
      },
    },
  };
  ddbMock.on(GetItemCommand).resolves(getItemOutput);
}
