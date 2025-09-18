
import { Session } from '@gemeentenijmegen/session';
import { Contactgegevens } from './ContactgegevensService';
import { UserFromSession } from '../zaken/User';
import * as overviewTemplate from './templates/contactgegevens.mustache';
import * as editTemplate from './templates/edit-contactgegevens.mustache';
import * as verifyTemplate from './templates/verify-contactgegevens.mustache';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';

export interface ErrorFlags {
  invalidTelefoon?: boolean;
  invalidEmail?: boolean;
  voorkeurTelefoonlMaarGeenTelefoon?: boolean;
  voorkeurEmailMaarGeenEmail?: boolean;
  generalError?: boolean;
  invalidVerificationCode?: boolean;
}

export class RenderingService {

  private navigation: Navigation;

  constructor(private session: Session) {
    const user = UserFromSession(session);
    this.navigation = new Navigation(user.type, {
      currentPath: '/contactgegevens',
      showContactgegevens: process.env.SHOW_CONTACTGEGEVENS === 'True',
    });
  }

  async renderOverview(contactgegevens: Contactgegevens, errors?: ErrorFlags) {
    const data = {
      ...this.getPageRanderingData(),
      email: contactgegevens.email,
      telefoonnummer: contactgegevens.telefoonnummer,
      voorkeurEmail: contactgegevens.voorkeur === 'email',
      voorkeurTelefoon: contactgegevens.voorkeur === 'telefoon',
      ...errors,
    };
    return render(data, overviewTemplate.default);
  }

  async renderEdit(contactgegevens: Contactgegevens, errors?: ErrorFlags) {
    const data = {
      ...this.getPageRanderingData(),
      volledigenaam: this.session.getValue('username'),
      xsrf_token: this.session.getValue('xsrf_token'),
      email: contactgegevens.email,
      telefoonnummer: contactgegevens.telefoonnummer,
      voorkeurEmail: contactgegevens.voorkeur === 'email',
      voorkeurTelefoon: contactgegevens.voorkeur === 'telefoon',
      ...errors,
    };
    return render(data, editTemplate.default);
  }

  async renderVerify(errors?: ErrorFlags) {
    const data = {
      ...this.getPageRanderingData(),
      ...errors,
    };
    return render(data, verifyTemplate.default);
  }

  private getPageRanderingData() {
    return {
      title: 'Mijn contactgegevens',
      nav: this.navigation.items,
      shownav: true,
      volledigenaam: this.session.getValue('username'),
      xsrf_token: this.session.getValue('xsrf_token'),
    };
  }
}
