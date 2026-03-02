import * as jwt from 'jsonwebtoken';
import { NotifyNLApi, SendEmailRequest, SendSmsRequest } from '../NotifyNLApi';

describe('NotifyNLApi', () => {
  let notifyNLApi: NotifyNLApi;
  const secret = 'secret-abc-def';
  const serviceId = 'service-123';

  beforeEach(() => {
    notifyNLApi = new NotifyNLApi({
      baseUrl: 'https://api.notify.nl',
      secret,
      issServiceId: serviceId,
    });
  });

  describe('sendEmail', () => {
    test('generates JWT with correct service ID', async () => {
      const request: SendEmailRequest = {
        email_address: 'test@example.com',
        template_id: 'template-123',
      };

      // Mock the postData method to capture the JWT
      const postDataSpy = jest.spyOn((notifyNLApi as any).apiclient, 'postData').mockResolvedValue({ id: 'notification-id' });

      await notifyNLApi.sendEmail(request);

      const callArgs = postDataSpy.mock.calls[0];
      const authHeader = callArgs[2].Authorization;
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.decode(token) as any;

      expect(decoded.iss).toBe(serviceId);
      expect(decoded.iat).toBeDefined();
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

      const postDataSpy = jest.spyOn((notifyNLApi as any).apiclient, 'postData').mockResolvedValue({ id: 'notification-id' });

      await notifyNLApi.sendEmail(request);

      expect(postDataSpy).toHaveBeenCalledWith(
        'https://api.notify.nl/v2/notifications/email',
        request,
        expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': expect.stringMatching(/^Bearer .+/),
        }),
      );
    });
  });

  describe('sendSms', () => {
    test('generates JWT with correct service ID', async () => {
      const request: SendSmsRequest = {
        phone_number: '0612345678',
        template_id: 'template-456',
      };

      const postDataSpy = jest.spyOn((notifyNLApi as any).apiclient, 'postData').mockResolvedValue({ id: 'notification-id' });

      await notifyNLApi.sendSms(request);

      const callArgs = postDataSpy.mock.calls[0];
      const authHeader = callArgs[2].Authorization;
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.decode(token) as any;

      expect(decoded.iss).toBe(serviceId);
      expect(decoded.iat).toBeDefined();
    });

    test('sends SMS with personalisation', async () => {
      const request: SendSmsRequest = {
        phone_number: '0612345678',
        template_id: 'template-456',
        personalisation: {
          code: '654321',
        },
      };

      const postDataSpy = jest.spyOn((notifyNLApi as any).apiclient, 'postData').mockResolvedValue({ id: 'notification-id' });

      await notifyNLApi.sendSms(request);

      expect(postDataSpy).toHaveBeenCalledWith(
        'https://api.notify.nl/v2/notifications/sms',
        request,
        expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': expect.stringMatching(/^Bearer .+/),
        }),
      );
    });
  });
});
