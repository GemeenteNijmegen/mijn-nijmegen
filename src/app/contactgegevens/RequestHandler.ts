import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { Contactgegevens, ContactgegevensSchema, ContactgegevensService } from './ContactgegevensService';
import { ErrorFlags, RenderingService } from './RenderingService';
import { RequestValidator } from './Validator';
import { VerificationService } from './VerificationService';
import { UserFromSession } from '../zaken/User';

export interface Config {
  readonly dynamoDBClient: DynamoDBClient;
  readonly contactgegevens: ContactgegevensService;
  readonly verification: VerificationService;
}

export interface RequestParameters {
  cookies: string;
  method: string;
  email?: string;
  telefoonnummer?: string;
  voorkeur?: string;
  xsrf_token?: string;
  error?: string[];
  path?: string;
  verificationCode?: string;
}

export class ContactgegevensRequestHandler {

  readonly config: Config;
  readonly logger: Logger;

  constructor(config: Config, logger?: Logger) {
    this.config = config;
    this.logger = logger ?? new Logger();
  }

  /**
   * Checks login and handles routing to correct handler
   * @param params
   * @returns
   */
  async handleRequest(params: RequestParameters): Promise<ApiGatewayV2Response> {

    const { path, method } = params;
    const session = new Session(params.cookies, this.config.dynamoDBClient);

    // Do login check
    await session.init();
    if (session.isLoggedIn() !== true) {
      return Response.redirect('/login');
    }

    // Do xsrf check on post
    if (method == 'POST') {
      this.checkXsrf(session, params.xsrf_token);
    }

    // Route to correct handler
    if (path?.endsWith('edit') && method == 'GET') {
      return this.handleEditRequest(session);
    } else if (path?.endsWith('edit') && method == 'POST') {
      return this.handleEditPostRequest(session, params);
    } else if (path?.endsWith('verify') && method == 'GET') {
      return this.handleVerify(session);
    } else if (path?.endsWith('verify') && method == 'POST') {
      return this.handleVerifyPost(session, params);
    } else {
      return this.handleOverviewRequest(session);
    }

  }

  /**
   * Renders the overview page showing the currently known contactgegevens
   * @param session
   * @returns
   */
  private async handleOverviewRequest(session: Session): Promise<ApiGatewayV2Response> {
    const user = UserFromSession(session);
    const contactgegevens = await this.config.contactgegevens.getContactgegevens(user);
    const renderingService = new RenderingService(session);
    const html = await renderingService.renderOverview(contactgegevens);
    return Response.html(html, 200, session.getCookie());
  }

  /**
   * Renders the edit page (shows the prefilled form) with currently known contactgegevens
   * @param session
   * @returns
   */
  private async handleEditRequest(session: Session): Promise<ApiGatewayV2Response> {
    const user = UserFromSession(session);
    const contactgegevens = await this.config.contactgegevens.getContactgegevens(user);
    const renderingService = new RenderingService(session);
    const html = await renderingService.renderEdit(contactgegevens);
    return Response.html(html, 200, session.getCookie());
  }

  /**
   * Returns the page for the verification screen
   * @param session
   * @returns
   */
  private async handleVerify(session: Session): Promise<ApiGatewayV2Response> {
    const renderingService = new RenderingService(session);
    const html = await renderingService.renderVerify();
    return Response.html(html, 200, session.getCookie());
  }

  /**
   * Processes the post request and when succesful redirects to the verification page
   * @returns
   */
  private async handleEditPostRequest(session: Session, params: RequestParameters): Promise<ApiGatewayV2Response> {

    const renderService = new RenderingService(session);

    try {

      const contactgegevens = ContactgegevensSchema.parse(params);

      // Check for errors in the submitted data
      const errors = RequestValidator.validate(params);
      if (RequestValidator.hasErrors(errors)) {
        const html = await renderService.renderEdit(contactgegevens, errors);
        return Response.html(html, 200, session.getCookie());
      }

      // Store submitted values in session
      if (params.email) {
        await session.setValue('emailToBe', params.email);
      }
      if (params.telefoonnummer) {
        await session.setValue('telefoonnummerToBe', params.telefoonnummer);
      }
      if (params.voorkeur) {
        await session.setValue('voorkeurToBe', params.voorkeur);
      }

      // Start verification
      await this.config.verification.startVerification(session, params.email!, 'email');

      // TODO when building this in the interface as well
      // await this.config.verification.startVerification(session, params.telefoonnummer!, 'sms');

      return Response.redirect('/contactgegevens/verify', 302, session.getCookie());

    } catch (error) {
      this.logger.error('Error', { error });
      const html = await renderService.renderEdit({}, { generalError: true });
      return Response.html(html, 200, session.getCookie());
    }
  }


  /**
   * Processes the verification post request and when succesful redirects to the contactgegevens page
   * @returns
   */
  private async handleVerifyPost(session: Session, params: RequestParameters): Promise<ApiGatewayV2Response> {

    const user = UserFromSession(session);
    const renderService = new RenderingService(session);
    const errors: ErrorFlags = {};

    try {

      // check if verification code is sent
      if (!params.verificationCode) {
        errors.invalidVerificationCode = true;
        const html = await renderService.renderVerify(errors);
        return Response.html(html, 200, session.getCookie());
      }

      // Get contactgegevens from session
      const contactgegevens: Contactgegevens = {
        email: session.getValue('emailToBe', params.email),
        telefoonnummer: session.getValue('telefoonnummerToBe', params.telefoonnummer),
        voorkeur: session.getValue('voorkeurToBe', params.voorkeur),
      };

      if (!contactgegevens.email) {
        throw Error('Expected email to be set'); // TODO this breaks when deleting an email
      }

      // check verification using notify
      const verified = await this.config.verification.checkVerification(session, params.verificationCode, contactgegevens.email, 'email');

      // TODO later also do sms verification
      // const verified = await this.config.verification.checkVerification(session, params.verificationCode, contactgegevens.telefoonnummer, 'sms');

      if (!verified || !verified.verified) {
        errors.invalidVerificationCode = true;
        const html = await renderService.renderVerify(errors);
        return Response.html(html, 200, session.getCookie());
      }

      if (user.type == 'person') {
        await this.config.contactgegevens.updateContactgegevensNatuurlijkPersoon(user, contactgegevens);
      } else {
        throw Error('Beheren van contactgegevens voor een organisatie is nog niet geimplementeerd');
      }

      // Do a redirect so we load the actual stored data from open klant.
      return Response.redirect('/contactgegevens', 302, session.getCookie());

    } catch (error) {
      this.logger.error('Error', { error });
      const html = await renderService.renderVerify({ generalError: true });
      return Response.html(html, 200, session.getCookie());
    }
  }

  /**
   * Does a xsrf check using the session and the provided token
   * @param session
   * @param xsrfToken
   */
  private checkXsrf(session: Session, xsrfToken?: string) {
    const xsrf = session.getValue('xsrf_token');
    if (xsrf !== xsrfToken) {
      this.logger.debug('XSRF Token mismatch', xsrf, xsrfToken);
      throw Error('xsrf_token mismatch!');
    }
  }


}
