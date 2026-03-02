import { ApiClient } from './ApiClient';

export interface NotifyNLConfig {
  apiclient: ApiClient;
  baseUrl: string;
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

  constructor(config: NotifyNLConfig) {
    this.apiclient = config.apiclient;
    this.baseUrl = config.baseUrl;
  }

  async sendEmail(request: SendEmailRequest): Promise<any> {
    const endpoint = `${this.baseUrl}/v2/notifications/email`;
    return await this.apiclient.postData(endpoint, request, {
      'Content-Type': 'application/json',
    });
  }

  async sendSms(request: SendSmsRequest): Promise<any> {
    const endpoint = `${this.baseUrl}/v2/notifications/sms`;
    return await this.apiclient.postData(endpoint, request, {
      'Content-Type': 'application/json',
    });
  }
}
