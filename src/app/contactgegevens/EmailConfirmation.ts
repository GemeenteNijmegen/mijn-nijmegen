interface EmailVerificationRequest {
  email: string;
  templateId: string;
  apiKey: string;
}

interface EmailVerificationResponse {
  success: boolean;
  message?: string;
  data?: any;
}

interface CodeVerificationRequest {
  code: string;
  email: string;
}

interface CodeVerificationResponse {
  success: boolean;
  message?: string;
  verified?: boolean;
  data?: any;
}

class EmailVerificationService {
  private baseUrl: string;
  private defaultTemplateId: string;
  private defaultApiKey: string;

  constructor(
    baseUrl: string = 'https://verificatie.notifynl.nl/api/verification-requests/',
    defaultApiKey: string,
    defaultTemplateId: string = 'b3cbd491-61b0-4427-8ee8-9dbc2fa614b1',
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultApiKey = defaultApiKey;
    this.defaultTemplateId = defaultTemplateId;
  }

  /**
   * Send an email verification request
   * @param email - The email address to verify
   * @param templateId - Optional template ID (uses default if not provided)
   * @param apiKey - Optional API key (uses default if not provided)
   * @returns Promise with the verification request response
   */
  async sendVerificationEmail(
    email: string,
    templateId?: string,
    apiKey?: string,
  ): Promise<EmailVerificationResponse> {
    try {
      const requestBody: EmailVerificationRequest = {
        email,
        templateId: templateId || this.defaultTemplateId,
        apiKey: apiKey || this.defaultApiKey,
      };

      const response = await fetch(`${this.baseUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        message: 'Verification email sent successfully',
        data,
      };

    } catch (error) {
      console.error('Error sending verification email:', error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Verify an email using the provided code
   * @param code - The verification code
   * @param email - The email address being verified
   * @returns Promise with the verification response
   */
  async verifyEmailCode(
    code: string,
    email: string,
  ): Promise<CodeVerificationResponse> {
    try {
      const requestBody: CodeVerificationRequest = {
        code,
        email,
      };

      const response = await fetch(`${this.baseUrl}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        verified: true,
        message: 'Email verified successfully',
        data,
      };

    } catch (error) {
      console.error('Error verifying email code:', error);

      return {
        success: false,
        verified: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

export default EmailVerificationService;
