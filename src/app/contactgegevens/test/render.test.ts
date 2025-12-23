
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { test } from 'vitest';
import { Navigation } from '../../../shared/Navigation';
import { render } from '../../../shared/render';
import * as editTemplate from '../templates/edit-contactgegevens.mustache?raw';

test('Render edit page', async () => {

  const navigation = new Navigation('person', {
    currentPath: '/contactgegevens',
    showContactgegevens: process.env.SHOW_CONTACTGEGEVENS == 'True',
  });

  const data = {
    title: 'Mijn contactgegevens bewerken',
    shownav: true,
    nav: navigation.items,
    volledigenaam: 'H. de Jong',
    xsrf_token: 'abcdef',
    email: 'devops@nijmegen.nl',
    emailError: true,
    telefoonnummer: '1234567',
    telefoonnummerError: true,
    errorMessage: undefined,
    voorkeurTelefoonlMaarGeenTelefoon: true,
    // voorkeurEmailMaarGeenEmail: true,
  };

  const html = await render(data, editTemplate.default);
  if (!existsSync('test-reports')) {
    mkdirSync('test-reports');
  }
  writeFileSync('test-reports/edit-contactgegevens.html', html);
});