import { ApiClient } from '../ApiClient';
import { NotifyNLApi, SendEmailRequest, SendSmsRequest } from '../NotifyNLApi';

describe('NotifyNLApi', () => {
  let mockApiClient: jest.Mocked<ApiClient>;
  let notifyNLApi: NotifyNLApi;

  beforeEach(() => {
    mockApiClient = {
      postData: jest.fn(),
      getData: jest.fn(),
    } as any;

    notifyNLApi = new NotifyNLApi({
      apiclient: mockApiClient,
      baseUrl: 'https://api.notify.nl',
    });
  });

  describe('sendEmail', () => {
    test('sends email with required fields', async () => {
      const request: SendEmailRequest = {
        email_address: 'test@example.com',
        template_id: 'template-123',
      };

      const expectedResponse = {
        id: 'notification-id',
        reference: null,
        content: {
          subject: 'Test Subject',
          body: 'Test Body',
        },
        uri: 'https://api.notify.nl/v2/notifications/notification-id',
        template: {
          id: 'template-123',
          version: 1,
          uri: 'https://api.notify.nl/v2/templates/template-123',
        },
      };

      mockApiClient.postData.mockResolvedValue(expectedResponse);

      const result = await notifyNLApi.sendEmail(request);

      expect(mockApiClient.postData).toHaveBeenCalledWith(
        'https://api.notify.nl/v2/notifications/email',
        request,
        { 'Content-Type': 'application/json' },
      );
      expect(result).toEqual(expectedResponse);
    });

    test('sends email with personalisation', async () => {
      const request: SendEmailRequest = {
        email_address: 'test@example.com',
        template_id: 'template-123',
        personalisation: {
          name: 'John Doe',
          code: '123456',
        },
      };

      mockApiClient.postData.mockResolvedValue({ id: 'notification-id' });

      await notifyNLApi.sendEmail(request);

      expect(mockApiClient.postData).toHaveBeenCalledWith(
        'https://api.notify.nl/v2/notifications/email',
        request,
        { 'Content-Type': 'application/json' },
      );
    });

    test('sends email with reference', async () => {
      const request: SendEmailRequest = {
        email_address: 'test@example.com',
        template_id: 'template-123',
        reference: 'ref-12345',
      };

      mockApiClient.postData.mockResolvedValue({ id: 'notification-id' });

      await notifyNLApi.sendEmail(request);

      expect(mockApiClient.postData).toHaveBeenCalledWith(
        'https://api.notify.nl/v2/notifications/email',
        request,
        { 'Content-Type': 'application/json' },
      );
    });
  });

  describe('sendSms', () => {
    test('sends SMS with required fields', async () => {
      const request: SendSmsRequest = {
        phone_number: '0612345678',
        template_id: 'template-456',
      };

      const expectedResponse = {
        id: 'notification-id',
        reference: null,
        content: {
          body: 'Test SMS Body',
        },
        uri: 'https://api.notify.nl/v2/notifications/notification-id',
        template: {
          id: 'template-456',
          version: 1,
          uri: 'https://api.notify.nl/v2/templates/template-456',
        },
      };

      mockApiClient.postData.mockResolvedValue(expectedResponse);

      const result = await notifyNLApi.sendSms(request);

      expect(mockApiClient.postData).toHaveBeenCalledWith(
        'https://api.notify.nl/v2/notifications/sms',
        request,
        { 'Content-Type': 'application/json' },
      );
      expect(result).toEqual(expectedResponse);
    });

    test('sends SMS with personalisation', async () => {
      const request: SendSmsRequest = {
        phone_number: '0612345678',
        template_id: 'template-456',
        personalisation: {
          code: '654321',
        },
      };

      mockApiClient.postData.mockResolvedValue({ id: 'notification-id' });

      await notifyNLApi.sendSms(request);

      expect(mockApiClient.postData).toHaveBeenCalledWith(
        'https://api.notify.nl/v2/notifications/sms',
        request,
        { 'Content-Type': 'application/json' },
      );
    });

    test('sends SMS with reference', async () => {
      const request: SendSmsRequest = {
        phone_number: '0612345678',
        template_id: 'template-456',
        reference: 'sms-ref-12345',
      };

      mockApiClient.postData.mockResolvedValue({ id: 'notification-id' });

      await notifyNLApi.sendSms(request);

      expect(mockApiClient.postData).toHaveBeenCalledWith(
        'https://api.notify.nl/v2/notifications/sms',
        request,
        { 'Content-Type': 'application/json' },
      );
    });
  });

  describe('error handling', () => {
    test('propagates errors from API client', async () => {
      const request: SendEmailRequest = {
        email_address: 'test@example.com',
        template_id: 'template-123',
      };

      mockApiClient.postData.mockRejectedValue(new Error('API Error'));

      await expect(notifyNLApi.sendEmail(request)).rejects.toThrow('API Error');
    });
  });
});
