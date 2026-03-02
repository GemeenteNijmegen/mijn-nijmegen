import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';
import { Persoonsgegevens, PersoonsgegevensMapper } from './Persoonsgegevens';
import * as contactgegevensTemplate from './templates/contactgegevens.mustache';
import * as editTemplate from './templates/edit-contactgegevens.mustache';
import * as template from './templates/mijngegevens.mustache';
import * as persoonsgegevensTemplate from './templates/persoonsgegevens.mustache';
import * as verifyTemplate from './templates/verify-contactgegevens.mustache';
import { HaalCentraalApi } from '../../shared/HaalCentraalApi';
import { BreadCrumbs, Navigation } from '../../shared/Navigation';
import { OpenKlantApi } from '../../shared/OpenKlantApi';
import { render } from '../../shared/render';

interface RenderData {
  volledigenaam: string;
  title: string;
  shownav: boolean;
  nav: any;
  breadcrumbs: any;
  persoonsgegevens?: Persoonsgegevens;
  error?: string;

  // Contactgegevens
  showContactgegevens?: boolean;
  email?: string;
  telefoonnummer?: string;
}

interface Config {
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
    return Response.html(html, 200, session.getCookie());
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

  private async handleEditRequest(session: Session, event: ParsedEvent) {
    const userType = session.getValue('user_type');
    if (userType != 'person') {
      return Response.redirect('/');
    }

    const type = event.queryStringParameters?.type || event.body?.type || 'email';
    const navigation = new Navigation(userType, { currentPath: '/persoonsgegevens' });
    const breadcrumbs = this.setupBreadcrumbs();

    if (event.method === 'POST') {
      // Validate XSRF token
      if (event.body?.xsrf_token !== session.getValue('xsrf_token')) {
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
      
      if (type === 'email' && !emailRegex.test(value)) {
        const data = {
          volledigenaam: session.getValue('username'),
          title: 'E-mailadres aanpassen',
          shownav: true,
          nav: navigation.items,
          breadcrumbs: breadcrumbs.items,
          type,
          isEmail: true,
          isPhone: false,
          currentValue: value,
          xsrf_token: session.getValue('xsrf_token'),
          error: 'Vul een geldig e-mailadres in',
        };
        const html = await render(data, editTemplate.default);
        return Response.html(html, 200, session.getCookie());
      }
      
      if (type === 'phonenumber' && !phoneRegex.test(value)) {
        const data = {
          volledigenaam: session.getValue('username'),
          title: 'Telefoonnummer aanpassen',
          shownav: true,
          nav: navigation.items,
          breadcrumbs: breadcrumbs.items,
          type,
          isEmail: false,
          isPhone: true,
          currentValue: value,
          xsrf_token: session.getValue('xsrf_token'),
          error: 'Vul een geldig telefoonnummer in',
        };
        const html = await render(data, editTemplate.default);
        return Response.html(html, 200, session.getCookie());
      }

      // Generate verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes

      // Store in session
      await session.setValues({
        [`pending_${type}`]: value,
        [`verification_code_${type}`]: code,
        [`verification_expiry_${type}`]: expiry.toString(),
        [`verification_attempts_${type}`]: '3',
      });

      // TODO: Send verification code via NotifyNL
      console.log(`Verification code for ${type}: ${code}`);

      return Response.redirect(`/persoonsgegevens/verify?type=${type}`, 302, session.getCookie());
    }

    // GET request - show form
    const currentValue = type === 'email' ? session.getValue('email') : session.getValue('phonenumber');
    const data = {
      volledigenaam: session.getValue('username'),
      title: type === 'email' ? 'E-mailadres aanpassen' : 'Telefoonnummer aanpassen',
      shownav: true,
      nav: navigation.items,
      breadcrumbs: breadcrumbs.items,
      type,
      isEmail: type === 'email',
      isPhone: type !== 'email',
      currentValue,
      xsrf_token: session.getValue('xsrf_token'),
    };

    const html = await render(data, editTemplate.default);
    return Response.html(html, 200, session.getCookie());
  }

  private async handleVerifyRequest(session: Session, event: ParsedEvent) {
    const userType = session.getValue('user_type');
    if (userType != 'person') {
      return Response.redirect('/');
    }

    const type = event.queryStringParameters?.type || event.body?.type || 'email';
    const navigation = new Navigation(userType, { currentPath: '/persoonsgegevens' });
    const breadcrumbs = this.setupBreadcrumbs();

    const pendingValue = session.getValue(`pending_${type}`);
    if (!pendingValue) {
      return Response.redirect('/persoonsgegevens');
    }

    if (event.method === 'POST') {
      // Validate XSRF token
      if (event.body?.xsrf_token !== session.getValue('xsrf_token')) {
        return Response.error(403);
      }

      const code = event.body?.code;
      const storedCode = session.getValue(`verification_code_${type}`);
      const expiry = parseInt(session.getValue(`verification_expiry_${type}`) || '0');
      let attempts = parseInt(session.getValue(`verification_attempts_${type}`) || '0');

      // Check expiry
      if (Date.now() > expiry) {
        await session.setValues({
          [`pending_${type}`]: '',
          [`verification_code_${type}`]: '',
          [`verification_expiry_${type}`]: '',
          [`verification_attempts_${type}`]: '',
        });
        return Response.redirect('/persoonsgegevens/edit?type=' + type, 302, session.getCookie());
      }

      // Check attempts
      if (attempts <= 0) {
        await session.setValues({
          [`pending_${type}`]: '',
          [`verification_code_${type}`]: '',
          [`verification_expiry_${type}`]: '',
          [`verification_attempts_${type}`]: '',
        });
        return Response.redirect('/persoonsgegevens', 302, session.getCookie());
      }

      // Validate code
      if (code === storedCode) {
        // Update OpenKlant
        if (this.config.openKlantApi) {
          try {
            const identifier = session.getValue('identifier');
            const currentEmail = session.getValue('email');
            const currentPhone = session.getValue('phonenumber');

            await this.config.openKlantApi.updateContactInfo(identifier, userType, {
              email: type === 'email' ? pendingValue : currentEmail,
              phonenumber: type === 'phonenumber' ? pendingValue : currentPhone,
            });

            // Update session
            await session.setValues({
              [type]: pendingValue,
              [`pending_${type}`]: '',
              [`verification_code_${type}`]: '',
              [`verification_expiry_${type}`]: '',
              [`verification_attempts_${type}`]: '',
            });

            return Response.redirect('/persoonsgegevens', 302, session.getCookie());
          } catch (error) {
            console.error('Failed to update contact info', error);
            const data = {
              volledigenaam: session.getValue('username'),
              title: 'Verificatie',
              shownav: true,
              nav: navigation.items,
              breadcrumbs: breadcrumbs.items,
              type,
              pendingValue,
              xsrf_token: session.getValue('xsrf_token'),
              attemptsLeft: attempts,
              error: 'Er is iets fout gegaan. Probeer het later opnieuw.',
            };
            const html = await render(data, verifyTemplate.default);
            return Response.html(html, 200, session.getCookie());
          }
        }
      } else {
        // Decrement attempts
        attempts--;

        if (attempts <= 0) {
          await session.setValues({
            [`pending_${type}`]: '',
            [`verification_code_${type}`]: '',
            [`verification_expiry_${type}`]: '',
            [`verification_attempts_${type}`]: '',
          });
          return Response.redirect('/persoonsgegevens', 302, session.getCookie());
        }

        await session.setValues({
          [`verification_attempts_${type}`]: attempts.toString(),
        });

        const data = {
          volledigenaam: session.getValue('username'),
          title: 'Verificatie',
          shownav: true,
          nav: navigation.items,
          breadcrumbs: breadcrumbs.items,
          type,
          pendingValue,
          xsrf_token: session.getValue('xsrf_token'),
          attemptsLeft: attempts,
          error: 'Ongeldige code. Probeer het opnieuw.',
        };

        const html = await render(data, verifyTemplate.default);
        return Response.html(html, 200, session.getCookie());
      }
    }

    // GET request - show form
    const attempts = parseInt(session.getValue(`verification_attempts_${type}`) || '3');
    const data = {
      volledigenaam: session.getValue('username'),
      title: 'Verificatie',
      shownav: true,
      nav: navigation.items,
      breadcrumbs: breadcrumbs.items,
      type,
      pendingValue,
      xsrf_token: session.getValue('xsrf_token'),
      attemptsLeft: attempts,
    };

    const html = await render(data, verifyTemplate.default);
    return Response.html(html, 200, session.getCookie());
  }
}
