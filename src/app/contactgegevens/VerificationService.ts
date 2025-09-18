import { Session } from '@gemeentenijmegen/session';
import jwt from 'jsonwebtoken';

export type VerificationType = 'sms' | 'email';

export interface VerificationService {
  startVerification(session: Session, adres: string, type: VerificationType): Promise<VerificationResponse>;
  checkVerification(session: Session, code: string, adres: string, type: VerificationType): Promise<CheckVerificationResponse>;
}

interface VerificationResponse {
  error?: string;
}

interface CheckVerificationResponse {
  verified: boolean;
  error?: string;
}

export interface NotifyNlVerificationServiceConfig {
  notifyIssuer: string;
  notifySecret: string;
  baseUrl: string;
  emailTemplate: string;
  smsTemplate: string;
}
export class NotifyNlVerificationService implements VerificationService {

  static readonly VERIFICAIION_CODE_IN_SESSION = 'verificationCode';

  constructor(private config: NotifyNlVerificationServiceConfig) { }

  private generateCode() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return code;
  }

  async startVerification(session: Session, adres: string, type: VerificationType): Promise<VerificationResponse> {
    try {
      // Get code
      const code = this.generateCode();

      // Store code in session
      await session.setValue(NotifyNlVerificationService.VERIFICAIION_CODE_IN_SESSION, code);

      // Send code using notify nl using the right channel
      if (type == 'email') {
        await this.sendEmail(code, adres);
      } else if (type == 'sms') {
        await this.sendSms(code, adres);
      }

      return {};

    } catch (error) {
      console.error('Error sending verification email:', error);

      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }

  }

  async checkVerification(session: Session, code: string, adres: string, type: VerificationType): Promise<CheckVerificationResponse> {

    try {

      const sessionCode = session.getValue(NotifyNlVerificationService.VERIFICAIION_CODE_IN_SESSION, code);

      if (!code || !sessionCode) {
        return {
          verified: false,
          error: 'missing code',
        };
      }

      if (code !== sessionCode) {
        return {
          verified: false,
          error: 'wrong code',
        };
      }

      return { verified: true };

    } catch (error) {
      console.error('Error sending verification email:', error);

      return {
        verified: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }

  }

  private async sendEmail(verificationCode: string, email: string) {
    const response = await fetch(this.config.baseUrl, {
      method: 'POST',
      body: JSON.stringify({
        template_id: this.config.emailTemplate,
        email_address: email,
        personalisation: {
          verificationCode: verificationCode,
        }
      }),
      headers: {
        'Content-type': 'application/json',
        'Authorization': `Bearer ${this.jwtToken()}`,
      },
    });
    if (!response.ok) {
      throw Error('Sending E-mail failed');
    }
    return response;
  }

  private async sendSms(verificationCode: string, phonenumber: string) {
    const response = await fetch(this.config.baseUrl, {
      method: 'POST',
      body: JSON.stringify({
        template_id: this.config.smsTemplate,
        phone_number: phonenumber,
        personalisation: {
          verificationCode: verificationCode,
        },
      }),
      headers: {
        'Content-type': 'application/json',
        'Authorization': `Bearer ${this.jwtToken()}`,
      },
    });
    if (!response.ok) {
      throw Error('Sending SMS failed');
    }
    return response;
  }

  private jwtToken() {
    const token = jwt.sign({
      iss: this.config.notifyIssuer,
      iat: Date.now(),
    }, this.config.notifySecret);
    return token;
  }

}


