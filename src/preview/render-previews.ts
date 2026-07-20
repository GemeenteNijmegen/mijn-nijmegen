import * as fs from 'fs';
import * as path from 'path';

import { homeSession, homeZaken, homeTaken } from './fixtures/home';
import { loginData } from './fixtures/login';
import { logoutData } from './fixtures/logout';
import { persoonsgegevensData, contactgegevensData, editContactgegevensData, verifyContactgegevensData } from './fixtures/persoonsgegevens';
import { productenApiResponse } from './fixtures/producten';
import { takenData } from './fixtures/taken';
import { uitkeringenData } from './fixtures/uitkeringen';
import { zakenList, singleZaak } from './fixtures/zaken';
import * as homeTemplate from '../app/home/templates/home.mustache';
import * as loginTemplate from '../app/login/templates/login.mustache';
import * as logoutTemplate from '../app/logout/templates/logout.mustache';
import * as contactgegevensPartial from '../app/persoonsgegevens/templates/contactgegevens.mustache';
import * as editContactgegevensTemplate from '../app/persoonsgegevens/templates/edit-contactgegevens.mustache';
import * as mijngegevensTemplate from '../app/persoonsgegevens/templates/mijngegevens.mustache';
import * as persoonsgegevensPartial from '../app/persoonsgegevens/templates/persoonsgegevens.mustache';
import * as verifyContactgegevensTemplate from '../app/persoonsgegevens/templates/verify-contactgegevens.mustache';
import { ProductFormatter } from '../app/producten/ProductFormatter';
import * as productenTemplate from '../app/producten/templates/producten.mustache';
import * as takenPageTemplate from '../app/taken/templates/taken.mustache';
import * as uitkeringenTemplate from '../app/uitkeringen/templates/uitkeringen.mustache';
import * as uitkeringsItem from '../app/uitkeringen/templates/uitkerings-item.mustache';
import * as singleZaakPartial from '../app/zaken/templates/singlezaak.mustache';
import * as takenPartial from '../app/zaken/templates/taken.mustache';
import * as zaakRow from '../app/zaken/templates/zaak-row.mustache';
import * as zaakTemplate from '../app/zaken/templates/zaak.mustache';
import * as zakenListPartial from '../app/zaken/templates/zaken-table.mustache';
import * as zakenTemplate from '../app/zaken/templates/zaken.mustache';
import { ZaakFormatter } from '../app/zaken/ZaakFormatter';
import { ArrowRight, Checkmark, Spinner } from '../shared/Icons';
import { Navigation, BreadCrumbs } from '../shared/Navigation';
import { render } from '../shared/render';

// Path from preview/<page>.html back to src/app/static-resources/static
const STATIC_REL = '../src/app/static-resources/static';
const OUT_DIR = path.join(process.cwd(), 'preview');

function rewriteStatic(html: string): string {
  return html
    .replace(/href="\/static/g, `href="${STATIC_REL}`)
    .replace(/src="\/static/g, `src="${STATIC_REL}`);
}

async function writePreview(name: string, html: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.html`), rewriteStatic(html));
  console.log(`  preview/${name}.html`);
}

async function renderLogin(): Promise<void> {
  const html = await render(loginData, loginTemplate.default);
  await writePreview('login', html);
}

async function renderLogout(): Promise<void> {
  const html = await render(logoutData, logoutTemplate.default);
  await writePreview('logout', html);
}

async function renderHome(): Promise<void> {
  const formatted = new ZaakFormatter().formatList(homeZaken);
  const zakenHtml = await render(
    { zaken: formatted.open, id: 'open-zaken-list', incompleteResults: false },
    zakenListPartial.default,
    { 'zaak-row': zaakRow.default },
  );
  const takenHtml = await render(
    { taken: homeTaken, takenid: 'taken-list', incompleteResults: false },
    takenPartial.default,
    { checkmark: Checkmark.default },
  );
  const navigation = new Navigation('person', { currentPath: '/' });
  const data = {
    title: 'overzicht',
    shownav: true,
    nav: navigation.items,
    has_sidenav: true,
    volledigenaam: homeSession.username,
    zaken: zakenHtml,
    has_zaken: true,
    taken: takenHtml,
    has_taken: homeTaken.length > 0,
    xsrf_token: 'preview-token',
    timeout: false,
    header_additions: '<link rel="stylesheet" href="/static/styles/zaak.css">',
    showContactgegevensNotice: false,
  };
  const html = await render(data, homeTemplate.default, {
    'spinner': Spinner.default,
    'arrow-right': ArrowRight.default,
    'checkmark': Checkmark.default,
  });
  await writePreview('home', html);
}

async function renderPersoonsgegevens(): Promise<void> {
  const navigation = new Navigation('person', { currentPath: '/persoonsgegevens' });
  const breadcrumbs = new BreadCrumbs([
    { title: 'Home', url: '/' },
    { title: 'Mijn gegevens', url: '/persoonsgegevens' },
  ]);
  const data = {
    title: 'Mijn gegevens',
    shownav: true,
    nav: navigation.items,
    has_sidenav: true,
    breadcrumbs: breadcrumbs.items,
    volledigenaam: 'Jan de Tester',
    persoonsgegevens: persoonsgegevensData,
    showContactgegevens: true,
    email: contactgegevensData.email,
    telefoonnummer: contactgegevensData.telefoonnummer,
  };
  const html = await render(data, mijngegevensTemplate.default, {
    contactgegevens: contactgegevensPartial.default,
    persoonsgegevens: persoonsgegevensPartial.default,
  });
  await writePreview('persoonsgegevens', html);
}

async function renderMijngegevens(): Promise<void> {
  const navigation = new Navigation('person', { currentPath: '/persoonsgegevens' });
  const breadcrumbs = new BreadCrumbs([
    { title: 'Home', url: '/' },
    { title: 'Mijn gegevens', url: '/persoonsgegevens' },
  ]);
  const data = {
    title: 'Mijn gegevens',
    shownav: true,
    nav: navigation.items,
    has_sidenav: true,
    breadcrumbs: breadcrumbs.items,
    volledigenaam: 'Jan de Tester',
    persoonsgegevens: persoonsgegevensData,
    showContactgegevens: false,
  };
  const html = await render(data, mijngegevensTemplate.default, {
    contactgegevens: contactgegevensPartial.default,
    persoonsgegevens: persoonsgegevensPartial.default,
  });
  await writePreview('mijngegevens', html);
}

async function renderContactgegevens(): Promise<void> {
  const navigation = new Navigation('person', { currentPath: '/persoonsgegevens' });
  const breadcrumbs = new BreadCrumbs([
    { title: 'Home', url: '/' },
    { title: 'Mijn gegevens', url: '/persoonsgegevens' },
  ]);
  const data = {
    title: 'E-mailadres aanpassen',
    shownav: true,
    nav: navigation.items,
    has_sidenav: true,
    breadcrumbs: breadcrumbs.items,
    volledigenaam: 'Jan de Tester',
    ...editContactgegevensData,
  };
  const html = await render(data, editContactgegevensTemplate.default);
  await writePreview('contactgegevens', html);
}

async function renderVerifyContactgegevens(): Promise<void> {
  const navigation = new Navigation('person', { currentPath: '/persoonsgegevens' });
  const breadcrumbs = new BreadCrumbs([
    { title: 'Home', url: '/' },
    { title: 'Mijn gegevens', url: '/persoonsgegevens' },
  ]);
  const data = {
    title: 'Verificatie',
    shownav: true,
    nav: navigation.items,
    has_sidenav: true,
    breadcrumbs: breadcrumbs.items,
    volledigenaam: 'Jan de Tester',
    ...verifyContactgegevensData,
  };
  const html = await render(data, verifyContactgegevensTemplate.default);
  await writePreview('verify-contactgegevens', html);
}

async function renderTaken(): Promise<void> {
  const navigation = new Navigation('person', { currentPath: '/taken' });
  const breadcrumbs = new BreadCrumbs([
    { title: 'Home', url: '/' },
    { title: 'Mijn taken', url: '/taken' },
  ]);
  const takenHtml = await render(
    { taken: takenData, takenid: 'taken-list', incompleteResults: false },
    takenPartial.default,
    { checkmark: Checkmark.default },
  );
  const data = {
    title: 'overzicht',
    shownav: true,
    nav: navigation.items,
    has_sidenav: true,
    breadcrumbs: breadcrumbs.items,
    volledigenaam: 'Jan de Tester',
    taken: takenHtml,
    has_taken: true,
    xsrf_token: 'preview-token',
    timeout: false,
    header_additions: '<link rel="stylesheet" href="/static/styles/zaak.css">',
  };
  const html = await render(data, takenPageTemplate.default, {
    spinner: Spinner.default,
  });
  await writePreview('taken', html);
}

async function renderUitkeringen(): Promise<void> {
  const navigation = new Navigation('person', { currentPath: '/uitkeringen' });
  const breadcrumbs = new BreadCrumbs([
    { title: 'Home', url: '/' },
    { title: 'Mijn uitkeringen', url: '/uitkeringen' },
  ]);
  const multipleUitkeringen = uitkeringenData.uitkeringen.length > 1;
  if (multipleUitkeringen) {
    uitkeringenData.uitkeringen.forEach((uitkering: any) => { uitkering.hideTypeHeading = true; });
  }
  const data = {
    ...uitkeringenData,
    volledigenaam: 'Jan de Tester',
    multipleUitkeringen,
    title: 'Mijn uitkeringen',
    shownav: true,
    nav: navigation.items,
    has_sidenav: true,
    breadcrumbs: breadcrumbs.items,
  };
  const html = await render(data, uitkeringenTemplate.default, {
    uitkering: uitkeringsItem.default,
  });
  await writePreview('uitkeringen', html);
}

async function renderProducten(): Promise<void> {
  const navigation = new Navigation('person', { currentPath: '/producten', showProducten: true });
  const products = productenApiResponse.results.map((p: any) => ProductFormatter.format(p));
  const data = {
    volledigenaam: 'Jan de Tester',
    title: 'Mijn Producten',
    shownav: true,
    nav: navigation.items,
    has_sidenav: true,
    products,
  };
  const html = await render(data, productenTemplate.default);
  await writePreview('producten', html);
}

async function renderZaken(): Promise<void> {
  const navigation = new Navigation('person', { currentPath: '/zaken' });
  const breadcrumbs = new BreadCrumbs([
    { title: 'Home', url: '/' },
    { title: 'Mijn zaken', url: '/zaken' },
  ]);
  const formatted = new ZaakFormatter().formatList(zakenList);
  const openHtml = await render(
    { zaken: formatted.open, id: 'open-zaken-list' },
    zakenListPartial.default,
    { 'zaak-row': zaakRow.default },
  );
  const closedHtml = await render(
    { zaken: formatted.gesloten, id: 'closed-zaken-list' },
    zakenListPartial.default,
    { 'zaak-row': zaakRow.default },
  );
  const data = {
    'volledigenaam': 'Jan de Tester',
    'title': 'Mijn zaken',
    'shownav': true,
    'nav': navigation.items,
    'breadcrumbs': breadcrumbs.items,
    'open-zaken': openHtml,
    'closed-zaken': closedHtml,
    'timeout': false,
    'xsrf_token': 'preview-token',
    'header_additions': '<link rel="stylesheet" href="/static/styles/zaak.css">',
  };
  const html = await render(data, zakenTemplate.default, {
    zaak: zaakRow.default,
    spinner: Spinner.default,
  });
  await writePreview('zaken', html);
}

async function renderSingleZaak(): Promise<void> {
  const navigation = new Navigation('person', { currentPath: '/zaken' });
  const formattedZaak = new ZaakFormatter().formatZaak(singleZaak);
  const breadcrumbs = new BreadCrumbs([
    { title: 'Home', url: '/' },
    { title: 'Mijn zaken', url: '/zaken' },
    { title: formattedZaak.zaak_identifier ?? 'Zaak', url: `/zaken/${singleZaak.internal_id}` },
  ]);
  const singleZaakHtml = await render(
    { zaak: formattedZaak },
    singleZaakPartial.default,
    { taken: takenPartial.default },
  );
  const data = {
    volledigenaam: 'Jan de Tester',
    title: `Zaak - ${formattedZaak.zaak_type}`,
    shownav: true,
    nav: navigation.items,
    has_sidenav: true,
    breadcrumbs: breadcrumbs.items,
    singlezaak: singleZaakHtml,
    timeout: false,
    xsrf_token: 'preview-token',
    header_additions: '<link rel="stylesheet" href="/static/styles/zaak.css">',
  };
  const html = await render(data, zaakTemplate.default, {
    taken: takenPartial.default,
    spinner: Spinner.default,
  });
  await writePreview('singlezaak', html);
}

export async function renderAll(): Promise<void> {
  console.log('Rendering previews...');
  await Promise.all([
    renderLogin(),
    renderLogout(),
    renderHome(),
    renderPersoonsgegevens(),
    renderMijngegevens(),
    renderContactgegevens(),
    renderVerifyContactgegevens(),
    renderTaken(),
    renderUitkeringen(),
    renderProducten(),
    renderZaken(),
    renderSingleZaak(),
  ]);
  console.log('Done.');
}

if (require.main === module) {
  renderAll().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
