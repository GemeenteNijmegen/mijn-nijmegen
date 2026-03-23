// NoAuthRequestHandler.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';

export interface NoAuthRequestHandlerProps {
  dynamoDBClient: DynamoDBClient;
  params: { bsn?: string, cookies: string };
}

/**
 * Development-only handler that bypasses OIDC authentication.
 * Creates a session identical in structure to what AuthRequestHandler produces.
 *
 * Activated by: NO_AUTH=true + NODE_ENV !== 'production'
 * DO NOT deploy to production.
 */
export class NoAuthRequestHandler {
  private config: NoAuthRequestHandlerProps;

  constructor(props: NoAuthRequestHandlerProps) {
    this.config = props;
  }

  async handleRequest(): Promise<ApiGatewayV2Response> {
    const fakeBsn = this.config.params.bsn;

    let session = new Session(this.config.params.cookies, this.config.dynamoDBClient);
    await session.init();

    if (session.sessionId === false) {
      return Response.redirect('/login');
    }

    try {
      const sessionData = {
        loggedin: { BOOL: true },
        identifier: { S: fakeBsn },
        bsn: { S: fakeBsn },           // legacy field, mirrors AuthRequestHandler
        user_type: { S: 'person' },
        username: { S: `Dev User (${fakeBsn})` },
        xsrf_token: { S: this.generateFakeState() },
      };

      await session.createSession(sessionData);
    } catch (error) {
      console.error('[DEV] NoAuth: creating session failed', error);
      return Response.error(500);
    }

    return Response.redirect('/', 302, [session.getCookie()]);
  }

  /**
   * Minimal stand-in for OpenIDConnect.generateState().
   * Cryptographic quality is not needed for dev.
   */
  private generateFakeState(): string {
    return `dev-${Math.random().toString(36).slice(2)}`;
  }
}
