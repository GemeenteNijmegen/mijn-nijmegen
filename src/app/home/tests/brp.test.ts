import fs from 'fs';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { BrpApi } from '../BrpApi';

async function getStringFromFilePath(filePath: string): Promise<string> {
  return new Promise((res, rej) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {return rej(err);}
      return res(data.toString());
    });
  });
}

beforeAll(() => {
  if (process.env.VERBOSETESTS!='True') {
    global.console.error = jest.fn();
    global.console.time = jest.fn();
    global.console.log = jest.fn();
  }
});

// This test doesn't run in CI by default, depends on unavailable secrets
test('Api', async () => {
  if (!process.env.CERTPATH || !process.env.KEYPATH || !process.env.CAPATH) {
    return;
  }
  const cert = await getStringFromFilePath(process.env.CERTPATH);
  const key = await getStringFromFilePath(process.env.KEYPATH);
  const ca = await getStringFromFilePath(process.env.CAPATH);
  const client = new ApiClient(cert, key, ca);
  const api = new BrpApi(client);
  const result = await api.getBrpData('900222670');
  expect(result.Persoon.BSN.BSN).toBe('900222670');
  expect(result.Persoon.Persoonsgegevens.Naam).toBe('A. de Smit');
});

// This test doesn't run in CI by default, depends on unavailable secrets
test('Api non-existent', async () => {
  if (
    !process.env.CERTPATH
    || !process.env.KEYPATH
    || !process.env.CAPATH
  ) {
    console.debug('Skipping live API test');
    return;
  }
  const cert = await getStringFromFilePath(process.env.CERTPATH);
  const key = await getStringFromFilePath(process.env.KEYPATH);
  const ca = await getStringFromFilePath(process.env.CAPATH);
  const client = new ApiClient(cert, key, ca);
  const api = new BrpApi(client);
  const result = await api.getBrpData('000000097');
  console.debug(result);
  expect(result.error).toBe('Het ophalen van gegevens is misgegaan.');
});