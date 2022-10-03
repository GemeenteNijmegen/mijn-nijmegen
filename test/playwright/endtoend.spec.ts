import { test, expect, Page } from '@playwright/test';

let page: Page;
test.beforeAll(async ({ browser }) => {
  // Create page once and sign in.
  page = await browser.newPage();
  // Go to https://mijn.accp.nijmegen.nl/login
  await page.goto('https://mijn.accp.nijmegen.nl/login');

  // Click text=Inloggen via DigiD
  await page.locator('text=Inloggen via DigiD').click();
  await expect(page).toHaveURL('https://authenticatie-accp.nijmegen.nl/broker/select/authn');

  // Click text=Simulator
  await page.locator('text=Simulator').click();
  await expect(page).toHaveURL('https://authenticatie-accp.nijmegen.nl/broker/authn/simulator/selection');

  // Click text=DigiD >> nth=0
  await page.locator('text=DigiD').first().click();
  await expect(page).toHaveURL('https://authenticatie-accp.nijmegen.nl/broker/authn/simulator/authenticate/digid');

  // Fill input[name="bsn"]
  await page.locator('input[name="bsn"]').fill('900026236');

  // Click [data-test="send-button"]
  await page.locator('[data-test="send-button"]').click();
  await expect(page).toHaveURL('https://mijn.accp.nijmegen.nl/');
});

test.afterAll(async () => {
  await page.close();
});

test('Visiting main page with valid BSN shows cards', async () => {

  // Click #navbar-collapse >> text=Uitkeringen
  await expect(page).toHaveURL('https://mijn.accp.nijmegen.nl/');

  // Click text=Hier vindt u een overzicht van uw uitkeringen.
  const cards =  page.locator('.card');
  await expect(cards).toContainText(['Persoonsgegevens', 'Uitkeringen']);
  await page.screenshot({ path: 'test/playwright/screenshots/home.png', fullPage: true });

});

test('Visiting uitkeringen-page with valid BSN shows info', async () => {

  // Click #navbar-collapse >> text=Uitkeringen
  await page.locator('#navbar-collapse >> text=Uitkeringen').click();
  await expect(page).toHaveURL('https://mijn.accp.nijmegen.nl/uitkeringen');

  // Click text=Hier vindt u een overzicht van uw uitkeringen.
  const table =  page.locator('table tbody').first();
  await expect(table).toContainText('BSN van klant');
  await page.screenshot({ path: 'test/playwright/screenshots/uitkering.png', fullPage: true });

});


test('Visiting persoonsgegevens-page with valid BSN shows info', async () => {

  // Click #navbar-collapse >> text=Uitkeringen
  await page.locator('#navbar-collapse >> text=Persoonsgegevens').click();
  await expect(page).toHaveURL('https://mijn.accp.nijmegen.nl/persoonsgegevens');

  // Click text=Hier vindt u een overzicht van uw uitkeringen.
  const table =  page.locator('h2');
  await expect(table).toContainText(['Persoonsgegevens', 'Adresgegevens']);
  await page.screenshot({ path: 'test/playwright/screenshots/persoonsgegevens.png', fullPage: true });

});