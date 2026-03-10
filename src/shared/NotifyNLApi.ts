import * as jwt from 'jsonwebtoken';
import { ApiClient } from './ApiClient';

export interface NotifyNLConfig {
  baseUrl: string;
  /**
   * Secret part of API key
   * See https://docs.notifications.service.gov.uk/rest-api.html#authorisation-header
   */
  secret: string;
  /**
   * Service ID part of API key
   * See https://docs.notifications.service.gov.uk/rest-api.html#authorisation-header
   */
  issServiceId: string;
}

export interface SendEmailRequest {
  email_address: string;
  template_id: string;
  personalisation?: Record<string, string>;
  reference?: string;
}

export interface SendSmsRequest {
  phone_number: string;
  template_id: string;
  personalisation?: Record<string, string>;
  reference?: string;
}

export class NotifyNLApi {
  private apiclient: ApiClient;
  private baseUrl: string;
  private serviceId: string;
  private secret: string;

  constructor(config: NotifyNLConfig) {
    this.baseUrl = config.baseUrl;
    this.secret = config.secret;
    this.serviceId = config.issServiceId;
    this.apiclient = new ApiClient({
      timeout: 3000,
    });
  }

  private generateJWT(): string {
    const payload = {
      iss: this.serviceId,
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.secret, {
      algorithm: 'HS256',
      header: {
        typ: 'JWT',
        alg: 'HS256',
      },
    });
  }

  async sendEmail(request: SendEmailRequest): Promise<any> {
    const endpoint = `${this.baseUrl}/v2/notifications/email`;
    const token = this.generateJWT();
    return this.apiclient.postData(endpoint, request, {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    });
  }

  async sendSms(request: SendSmsRequest): Promise<any> {
    const endpoint = `${this.baseUrl}/v2/notifications/sms`;
    const token = this.generateJWT();
    return this.apiclient.postData(endpoint, request, {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    });
  }
}
