import fs from 'fs';
import { FileConnector } from '../FileConnector';
import { HTTPConnector } from '../HTTPConnector';
import { UitkeringsApi } from '../UitkeringsApi';
import { ApiClient } from '../ApiClient';


async function getStringFromFilePath(filePath: string) {
  return new Promise((res, rej) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {return rej(err);}
      return res(data.toString());
    });
  });
}

test('returns empty if not found', async () => {
  let api = new UitkeringsApi('00000000', FileConnector);
  const result = await api.getUitkeringen();
  expect(result.uitkeringen).toHaveLength(0);
});

test('returns empty if no result', async () => {
  const api = new UitkeringsApi('empty', FileConnector);
  const result = await api.getUitkeringen();
  expect(result.uitkeringen).toHaveLength(0);
});

test('returns one uitkering', async () => {
  const api = new UitkeringsApi('12345678', FileConnector);
  const result = await api.getUitkeringen();
  expect(result.uitkeringen).toHaveLength(1);
  expect(result.uitkeringen[0].fields).toBeInstanceOf(Array);
});

test('returns two uitkeringen', async () => {
  const api = new UitkeringsApi('tweeuitkeringen', FileConnector);
  const result = await api.getUitkeringen();
  expect(result.uitkeringen).toHaveLength(2);
});

// This test doesn't run in CI by default, depends on unavailable secrets
test('HTTP Connector', async () => {
  if (!process.env.CERTPATH || !process.env.KEYPATH || !process.env.CAPATH) {
    return;
  }
  const cert = await getStringFromFilePath(process.env.CERTPATH);
  const key = await getStringFromFilePath(process.env.KEYPATH);
  const ca = await getStringFromFilePath(process.env.CAPATH);
  const client = new ApiClient(cert, key, ca);
  const connector = await new HTTPConnector(900070341, client);
  const result = await connector.requestData();
  expect(result).toContain('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">');
});