import * as crypto from 'crypto';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';
import { Persoonsgegevens, PersoonsgegevensMapper } from './Persoonsgegevens';
import { Statics } from '../../statics';
import * as contactgegevensTemplate from './templates/contactgegevens.mustache';
import * as editTemplate from './templates/edit-contactgegevens.mustache';
import * as template from './templates/mijngegevens.mustache';
import * as persoonsgegevensTemplate from './templates/persoonsgegevens.mustache';
import * as verifyTemplate from './templates/verify-contactgegevens.mustache';
import { VerificationRateLimiter } from './VerificationRateLimiter';
import { HaalCentraalApi } from '../../shared/HaalCentraalApi';
import { BreadCrumbs, Navigation } from '../../shared/Navigation';
import { NotifyNLApi } from '../../shared/NotifyNLApi';
import { OpenKlantApi } from '../../shared/OpenKlantApi';
import { render } from '../../shared/render';

interface RenderData {
  volledigenaam: string;
  title: string;
  shownav: boolean;
  nav: any;
  has_sidenav: boolean;
  breadcrumbs: any;
  persoonsgegevens?: Persoonsgegevens;
  error?: string;

  // Contactgegevens
  showContactgegevens?: boolean;
  email?: string;
  telefoonnummer?: string;
}

export interface Config {
  dynamoDBClient: DynamoDBClient;
  /**
   * Provide a HaalCentraal API client when if
   * want to use HaalCentraal.
   */
  haalCentraalApi: HaalCentraalApi;
  /**
   * OpenKlant API client
   */
  openKlantApi?: OpenKlantApi;
  /**
   * NotifyNL API client
   */
  notifyNLApi?: NotifyNLApi;
  /**
   * NotifyNL template IDs
   */
  notifyEmailTemplateId?: string;
  notifySmsTemplateId?: string;
  /**
   * Contactgegevens live
   */
  contactgegevensLive?: boolean;
}

export interface ParsedEvent {
  cookies: string;
  method: string;
  body: any;
  path: string;
  queryStringParameters: any;
}

export class PersoonsgegevensRequestHandler {

  constructor(private config: Config) { }

  async handleRequest(event: ParsedEvent) {
    console.time('request');
    console.timeLog('request', 'start request');

    // Session initalization
    console.timeLog('request', 'start init');
    let session = new Session(event.cookies, this.config.dynamoDBClient);
    await session.init();
    console.timeLog('request', 'init session');

    // Handle request if loggedin
    if (session.isLoggedIn() == true) {
      if (event.path?.startsWith('/persoonsgegevens/edit')) {
        console.info('Handling EDIT request');
        const response = await this.handleEditRequest(session, event);
        console.timeEnd('request');
        return response;
      } else if (event.path?.startsWith('/persoonsgegevens/verify')) {
        console.info('Handling VERIFY request');
        const response = await this.handleVerifyRequest(session, event);
        console.timeEnd('request');
        return response;
      } else {
        console.info('Handling OVERVIEW request');
        const response = await this.handleLoggedinRequest(session);
        console.timeEnd('request');
        return response;
      }
    }

    console.timeEnd('request');
    return Response.redirect('/login');
  }

  private async handleLoggedinRequest(session: Session) {

    // Get the users BSN - Companies can log in, but can't use this page.
    const userType = session.getValue('user_type');
    if (userType != 'person') {
      return Response.redirect('/');
    }
    const bsn = session.getValue('identifier');

    // Setup view
    const navigation = new Navigation(userType, {
      currentPath: '/persoonsgegevens',
    });

    const breadcrumbs = this.setupBreadcrumbs();
    const data: RenderData = {
      volledigenaam: session.getValue('username'),
      title: 'Mijn gegevens',
      shownav: true,
      nav: navigation.items,
      has_sidenav: true,
      breadcrumbs: breadcrumbs.items,
      persoonsgegevens: undefined,
      error: undefined,
      // Contactgegevens
      showContactgegevens: this.config.contactgegevensLive,
      email: session.getValue('email'),
      telefoonnummer: session.getValue('phonenumber'),
    };

    // Get BRP data from HaalCentraal
    try {
      console.timeLog('request', 'starting HAAL CENTRAAL BRP API call');
      const brpData = await this.config.haalCentraalApi.getBrpData(new Bsn(bsn), [
        'burgerservicenummer', 'naam', 'adressering', 'geslacht', 'nationaliteiten', 'geboorte', 'verblijfplaatsBinnenland',
      ]);
      data.persoonsgegevens = PersoonsgegevensMapper.fromHaalCentraal(brpData);
      console.timeLog('request', 'finished HAAL CENTRAAL BRP API call');
    } catch (error) {
      console.log(error);
      data.error = 'Het ophalen van uw persoonsgegevens is misgegaan.';
      data.persoonsgegevens = undefined;
    }

    // render page
    const html = await render(data, template.default, {
      contactgegevens: contactgegevensTemplate.default,
      persoonsgegevens: persoonsgegevensTemplate.default,
    });
    return Response.html(html, 200, session.getCookie({ sameSite: 'lax' }));
  }

  private setupBreadcrumbs() {
    const crumbs = [
      {
        title: 'Home',
        url: '/',
      }, {
        title: 'Mijn gegevens',
        url: '/persoonsgegevens',
      },
    ];
    return new BreadCrumbs(crumbs);
  }

  private retryAfterMessage(retryAfterSeconds: number): string {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    return `Probeer het over ${minutes} ${minutes === 1 ? 'minuut' : 'minuten'} opnieuw.`;
  }

  private withRetryAfter(response: ApiGatewayV2Response, retryAfterSeconds: number): ApiGatewayV2Response {
    response.headers = { ...response.headers, 'Retry-After': String(retryAfterSeconds) };
    return response;
  }

  private async handleEditRequest(session: Session, event: ParsedEvent) {
    const userType = session.getValue('user_type');
    if (userType != 'person') {
      return Response.redirect('/');
    }
    const navigation = new Navigation(userType, { currentPath: '/persoonsgegevens' });

    const type = event.queryStringParameters?.type || event.body?.type || 'email';
    if (type !== 'email' && type !== 'phonenumber') {
      console.info('Rejected unknown contactgegevens type', type);
      return Response.error(400);
    }
    const isEmailType = type === 'email';
    const isPhoneType = type === 'phonenumber';

    const breadcrumbs = this.setupBreadcrumbs();

    const xsrfToken = session.getValue('xsrf_token');
    if (event.method === 'POST') {
      if (event.body?.xsrf_token !== xsrfToken) {
        console.info('XSRF token mismatch');
        return Response.error(403);
      }

      const value = event.body?.value;
      if (!value) {
        console.info('Bad post request for contactgegevens form');
        return Response.error(400);
      }

      // Validate format
      const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      const phoneRegex = /^(0[8-9]00[0-9]{4,7})|(0[1-9][0-9]{8})|(\+[0-9]{9,20}|1400|140[0-9]{2,3})$/;

      if (isEmailType && !emailRegex.test(value)) {
        const data = {
          volledigenaam: session.getValue('username'),
          title: 'E-mailadres aanpassen',
          shownav: true,
          nav: navigation.items,
          has_sidenav: navigation.items ? true : false,
          breadcrumbs: breadcrumbs.items,
          type,
          isEmail: isEmailType,
          isPhone: isPhoneType,
          currentValue: value,
          xsrf_token: xsrfToken,
          error: 'Vul een geldig e-mailadres in',
        };
        const html = await render(data, editTemplate.default);
        return Response.html(html, 200, session.getCookie({ sameSite: 'lax' }));
      }

      if (isPhoneType && !phoneRegex.test(value)) {
        const data = {
          volledigenaam: session.getValue('username'),
          title: 'Telefoonnummer aanpassen',
          shownav: true,
          nav: navigation.items,
          has_sidenav: navigation.items ? true : false,
          breadcrumbs: breadcrumbs.items,
          type,
          isEmail: isEmailType,
          isPhone: isPhoneType,
          currentValue: value,
          xsrf_token: xsrfToken,
          error: 'Vul een geldig telefoonnummer in',
        };
        const html = await render(data, editTemplate.default);
        return Response.html(html, 200, session.getCookie({ sameSite: 'lax' }));
      }

      // Enforce issuance rate limit (atomic, session-scoped)
      const issueRateLimiter = new VerificationRateLimiter({
        dynamoDBClient: this.config.dynamoDBClient,
        windowMs: Statics.verificationRateLimitWindowMs,
      });
      const issueOutcome = await issueRateLimiter.consume(session.sessionHash as string, type, 'issue', Statics.verificationMaxIssuancePerHour);
      if (!issueOutcome.allowed) {
        const data = {
          volledigenaam: session.getValue('username'),
          title: isEmailType ? 'E-mailadres aanpassen' : 'Telefoonnummer aanpassen',
          shownav: true,
          nav: navigation.items,
          has_sidenav: navigation.items ? true : false,
          breadcrumbs: breadcrumbs.items,
          type,
          isEmail: isEmailType,
          isPhone: isPhoneType,
          currentValue: value,
          xsrf_token: xsrfToken,
          error: `U heeft te veel verificatiecodes aangevraagd. ${this.retryAfterMessage(issueOutcome.retryAfterSeconds)}`,
        };
        const html = await render(data, editTemplate.default);
        return this.withRetryAfter(
          Response.html(html, 429, session.getCookie({ sameSite: 'lax' })),
          issueOutcome.retryAfterSeconds,
        );
      }

      // Generate verification code
      const code = crypto.randomInt(100000, 1000000).toString();
      const expiryOfCode = Date.now() + 15 * 60 * 1000; // 15 minutes

      // Store in session
      await session.setValues({
        [`pending_${type}`]: value,
        [`verification_code_${type}`]: code,
        [`verification_expiry_${type}`]: expiryOfCode.toString(),
      });

      await this.sendVerificationCode(isEmailType, value, code, isPhoneType);


      return Response.redirect(`/persoonsgegevens/verify?type=${type}`, 302, session.getCookie({ sameSite: 'lax' }));
    }

    // GET request - show form
    const currentValue = isEmailType ? session.getValue('email') : session.getValue('phonenumber');
    const data = {
      volledigenaam: session.getValue('username'),
      title: isEmailType ? 'E-mailadres aanpassen' : 'Telefoonnummer aanpassen',
      shownav: true,
      nav: navigation.items,
      has_sidenav: navigation.items ? true : false,
      breadcrumbs: breadcrumbs.items,
      type,
      isEmail: isEmailType,
      isPhone: isPhoneType,
      currentValue,
      xsrf_token: xsrfToken,
    };

    const html = await render(data, editTemplate.default);
    return Response.html(html, 200, session.getCookie({ sameSite: 'lax' }));
  }

  /**
   * Send verification code via NotifyNL
   */
  private async sendVerificationCode(isEmailType: boolean, value: any, code: string, isPhoneType: boolean) {
    if (!this.config.notifyNLApi) return;

    try {
      if (isEmailType && this.config.notifyEmailTemplateId) {
        return await this.config.notifyNLApi.sendEmail({
          email_address: value,
          template_id: this.config.notifyEmailTemplateId,
          personalisation: {
            verificationCode: code,
          },
        });
      }
      if (isPhoneType && this.config.notifySmsTemplateId) {
        return await this.config.notifyNLApi.sendSms({
          phone_number: value,
          template_id: this.config.notifySmsTemplateId,
          personalisation: {
            verificationCode: code,
          },
        });
      }

      console.error(`No NotifyNL template ID provided for ${isEmailType ? 'email' : 'SMS'}`);

    } catch (error) {
      console.error('Failed to send verification code', error);
    }
  }

  private async handleVerifyRequest(session: Session, event: ParsedEvent) {
    const userType = session.getValue('user_type');
    if (userType != 'person') {
      return Response.redirect('/');
    }

    const type = event.queryStringParameters?.type || event.body?.type || 'email';
    if (type !== 'email' && type !== 'phonenumber') {
      console.info('Rejected unknown contactgegevens type', type);
      return Response.error(400);
    }
    const navigation = new Navigation(userType, { currentPath: '/persoonsgegevens' });
    const breadcrumbs = this.setupBreadcrumbs();
    const xsrfToken = session.getValue('xsrf_token');

    const pendingValue = session.getValue(`pending_${type}`);
    if (!pendingValue) {
      return Response.redirect('/persoonsgegevens');
    }


    if (event.method === 'POST') {
      // Validate XSRF token
      if (event.body?.xsrf_token !== xsrfToken) {
        return Response.error(403);
      }

      const code = event.body?.code;
      const storedCode = session.getValue(`verification_code_${type}`);
      const expiryOfCode = parseInt(session.getValue(`verification_expiry_${type}`) || '0');

      // Check expiry first: an already-expired code isn't a real "attempt"
      // at guessing, so it shouldn't spend any of the verify rate limit.
      if (Date.now() > expiryOfCode) {
        await session.setValues({
          [`pending_${type}`]: '',
          [`verification_code_${type}`]: '',
          [`verification_expiry_${type}`]: '',
        });
        return Response.redirect('/persoonsgegevens/edit?type=' + type, 302, session.getCookie({ sameSite: 'lax' }));
      }

      // Enforce verification attempt rate limit (atomic, session-scoped).
      // Runs before comparing the code so it can't be bypassed by requesting a
      // fresh code. It persists across newly-issued codes within this session.
      const verifyRateLimiter = new VerificationRateLimiter({
        dynamoDBClient: this.config.dynamoDBClient,
        windowMs: Statics.verificationRateLimitWindowMs,
      });
      const verifyOutcome = await verifyRateLimiter.consume(session.sessionHash as string, type, 'verify', Statics.verificationMaxAttemptsPerHour);
      if (!verifyOutcome.allowed) {
        const data = {
          volledigenaam: session.getValue('username'),
          title: 'Verificatie',
          shownav: true,
          nav: navigation.items,
          has_sidenav: navigation.items ? true : false,
          breadcrumbs: breadcrumbs.items,
          type,
          pendingValue,
          xsrf_token: xsrfToken,
          attemptsLeft: 0,
          error: `U heeft te veel pogingen gedaan. ${this.retryAfterMessage(verifyOutcome.retryAfterSeconds)}`,
        };
        const html = await render(data, verifyTemplate.default);
        return this.withRetryAfter(
          Response.html(html, 429, session.getCookie({ sameSite: 'lax' })),
          verifyOutcome.retryAfterSeconds,
        );
      }

      // Validate code
      if (code === storedCode) {
        if (!this.config.openKlantApi) {
          console.error('Cannot confirm verification: OpenKlant API is not configured');
          const data = {
            volledigenaam: session.getValue('username'),
            title: 'Verificatie',
            shownav: true,
            nav: navigation.items,
            has_sidenav: navigation.items ? true : false,
            breadcrumbs: breadcrumbs.items,
            type,
            pendingValue,
            xsrf_token: xsrfToken,
            attemptsLeft: verifyOutcome.remaining,
            error: 'Er is iets fout gegaan. Probeer het later opnieuw.',
          };
          const html = await render(data, verifyTemplate.default);
          return Response.html(html, 200, session.getCookie({ sameSite: 'lax' }));
        }

        try {
          const identifier = session.getValue('identifier');

          await this.config.openKlantApi.updateContactInfo(identifier, userType, {
            email: type == 'email' ? pendingValue : undefined,
            phonenumber: type == 'phonenumber' ? pendingValue : undefined,
          });

          // Update session
          await session.setValues({
            [type]: pendingValue,
            [`pending_${type}`]: '',
            [`verification_code_${type}`]: '',
            [`verification_expiry_${type}`]: '',
          });

          return Response.redirect('/persoonsgegevens', 302, session.getCookie({ sameSite: 'lax' }));
        } catch (error) {
          console.error('Failed to update contact info', error);
          const data = {
            volledigenaam: session.getValue('username'),
            title: 'Verificatie',
            shownav: true,
            nav: navigation.items,
            has_sidenav: navigation.items ? true : false,
            breadcrumbs: breadcrumbs.items,
            type,
            pendingValue,
            xsrf_token: xsrfToken,
            attemptsLeft: verifyOutcome.remaining,
            error: 'Er is iets fout gegaan. Probeer het later opnieuw.',
          };
          const html = await render(data, verifyTemplate.default);
          return Response.html(html, 200, session.getCookie({ sameSite: 'lax' }));
        }
      } else {
        if (verifyOutcome.remaining <= 0) {
          await session.setValues({
            [`pending_${type}`]: '',
            [`verification_code_${type}`]: '',
            [`verification_expiry_${type}`]: '',
          });
          return Response.redirect('/persoonsgegevens', 302, session.getCookie({ sameSite: 'lax' }));
        }

        const data = {
          volledigenaam: session.getValue('username'),
          title: 'Verificatie',
          shownav: true,
          nav: navigation.items,
          has_sidenav: navigation.items ? true : false,
          breadcrumbs: breadcrumbs.items,
          type,
          pendingValue,
          xsrf_token: xsrfToken,
          attemptsLeft: verifyOutcome.remaining,
          error: 'Ongeldige code. Probeer het opnieuw.',
        };

        const html = await render(data, verifyTemplate.default);
        return Response.html(html, 200, session.getCookie({ sameSite: 'lax' }));
      }
    }

    // GET request - show form
    const verifyRateLimiter = new VerificationRateLimiter({
      dynamoDBClient: this.config.dynamoDBClient,
      windowMs: Statics.verificationRateLimitWindowMs,
    });
    const attemptsLeft = await verifyRateLimiter.remaining(
      session.sessionHash as string, type, 'verify', Statics.verificationMaxAttemptsPerHour,
    );
    const data = {
      volledigenaam: session.getValue('username'),
      title: 'Verificatie',
      shownav: true,
      nav: navigation.items,
      has_sidenav: navigation.items ? true : false,
      breadcrumbs: breadcrumbs.items,
      type,
      pendingValue,
      xsrf_token: xsrfToken,
      attemptsLeft,
    };

    const html = await render(data, verifyTemplate.default);
    return Response.html(html, 200, session.getCookie({ sameSite: 'lax' }));
  }
}
