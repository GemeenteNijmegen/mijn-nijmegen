import { Session } from '@gemeentenijmegen/session';

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

export class NotifyNlVerificationService implements VerificationService {

  static readonly VERIFICAIION_CODE_IN_SESSION = 'verificationCode';

  constructor(
    private apiKey: string,
    private baseUrl: string = 'https://verificatie.notifynl.nl/api/verification-requests/',
    private emailTemplate: string,
    private smsTemplate: string,
  ) { }

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
      const templateId = type == 'email' ? this.emailTemplate : this.smsTemplate;

      // TODO api call to notify

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

}


