import AxeBuilder from '@axe-core/playwright';
import { expect, Page } from '@playwright/test';
import test from './lambdatest-setup';

test.beforeEach(async ({ page }) => {
  // Go to https://mijn.accp.nijmegen.nl/login
  await page.goto('https://mijn.accp.nijmegen.nl/');
  await expect(page).toHaveURL('https://mijn.accp.nijmegen.nl/login');

  // Click text=Inloggen via DigiD
  await page.locator('a[href*="digid"]').click();
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

test('Visiting main page with valid BSN shows menu', async ({ page }) => {
  // Click #navbar-collapse >> text=Uitkeringen
  await expect(page).toHaveURL('https://mijn.accp.nijmegen.nl/');

  // Click text=Hier vindt u een overzicht van uw uitkeringen.
  const menu = page.locator('.nijmegen-sidenav');
  await expect(menu.getByText('Mijn gegevens')).toHaveAttribute('href');
  await expect(menu.getByText('Mijn uitkering')).toHaveAttribute('href');
  await page.screenshot({ path: 'test/playwright/screenshots/home.png', fullPage: true });

});

test('Visiting uitkeringen-page with valid BSN shows info', async ({ page }) => {

  const menu = page.locator('.nijmegen-sidenav');
  // Click #navbar-collapse >> text=Uitkeringen
  await menu.getByText('Mijn uitkering').click();
  await expect(page).toHaveURL('https://mijn.accp.nijmegen.nl/uitkeringen');

  // Click text=Hier vindt u een overzicht van uw uitkeringen.
  const table = page.locator('table tbody').first();
  await expect(table).toContainText('BSN van klant');
  await page.screenshot({ path: 'test/playwright/screenshots/uitkering.png', fullPage: true });
});


test('Visiting persoonsgegevens-page with valid BSN shows info', async ({ page }) => {

  // Click #navbar-collapse >> text=Uitkeringen
  const menu = page.locator('.nijmegen-sidenav');
  await menu.getByText('Mijn gegevens').click();
  await expect(page).toHaveURL('https://mijn.accp.nijmegen.nl/persoonsgegevens');

  // Click text=Hier vindt u een overzicht van uw uitkeringen.
  const table = page.locator('h2');
  await expect(table).toContainText(['Persoonsgegevens', 'Adresgegevens']);
  await page.screenshot({ path: 'test/playwright/screenshots/persoonsgegevens.png', fullPage: true });

});
