import fs from 'fs';
import { ApiClient } from '../ApiClient';
import { FileApiClient } from '../FileApiClient';
import { UitkeringsApi } from '../UitkeringsApi';


async function getStringFromFilePath(filePath: string) {
  return new Promise((res, rej) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {return rej(err);}
      return res(data.toString());
    });
  });
}

// test('returns empty if not found', async () => {
//   const client = new FileApiClient();
//   let api = new UitkeringsApi(client);
//   const result = await api.getUitkeringen('00000000');
//   expect(result.uitkeringen).toHaveLength(0);
// });

// test('returns empty if no result', async () => {
//   const client = new FileApiClient();
//   let api = new UitkeringsApi(client);
//   const result = await api.getUitkeringen('00000000');
//   expect(result.uitkeringen).toHaveLength(0);
// });

test('returns one uitkering', async () => {
  const client = new FileApiClient();
  let api = new UitkeringsApi(client);
  const result = await api.getUitkeringen('00000000');
  expect(result.uitkeringen).toHaveLength(1);
  expect(result.uitkeringen[0].fields).toBeInstanceOf(Array);
});

// test('returns two uitkeringen', async () => {
//   const client = new FileApiClient();
//   let api = new UitkeringsApi(client);
//   const result = await api.getUitkeringen('00000000');
//   expect(result.uitkeringen).toHaveLength(2);
// });

// This test doesn't run in CI by default, depends on unavailable secrets
test('Http Api', async () => {
  if (
    !process.env.CERTPATH
      || !process.env.KEYPATH
      || !process.env.CAPATH
      || !process.env.BSN
      || !process.env.UITKERING_API_URL
      || !process.env.UITKERING_BSN) {
    console.debug('skipping live api test');
    return;
  }
  const cert = await getStringFromFilePath(process.env.CERTPATH);
  const key = await getStringFromFilePath(process.env.KEYPATH);
  const ca = await getStringFromFilePath(process.env.CAPATH);
  const client = new ApiClient(cert, key, ca);
  const body = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
            <ns2:dataRequest xmlns:ns2="${process.env.UITKERING_API_URL}/">
                <identifier>${process.env.UITKERING_BSN}</identifier>
                <contentSource>mijnUitkering</contentSource>
            </ns2:dataRequest>
        </soap:Body>
    </soap:Envelope>`;

  const result = await client.requestData(process.env.UITKERING_API_URL, body, {
    'Content-type': 'text/xml',
    'SoapAction': process.env.UITKERING_API_URL + '/getData',
  });
  console.debug(result);
  expect(result).toContain('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">');
});


// This test doesn't run in CI by default, depends on unavailable secrets
test('Http Api No result', async () => {
  if (
    !process.env.CERTPATH
      || !process.env.KEYPATH
      || !process.env.CAPATH
      || !process.env.BSN
      || !process.env.UITKERING_API_URL
      || !process.env.UITKERING_BSN) {
    console.debug('skipping live api test');
    return;
  }
  const cert = await getStringFromFilePath(process.env.CERTPATH);
  const key = await getStringFromFilePath(process.env.KEYPATH);
  const ca = await getStringFromFilePath(process.env.CAPATH);
  const client = new ApiClient(cert, key, ca);
  const body = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
            <ns2:dataRequest xmlns:ns2="${process.env.UITKERING_API_URL}/">
                <identifier>12345678</identifier>
                <contentSource>mijnUitkering</contentSource>
            </ns2:dataRequest>
        </soap:Body>
    </soap:Envelope>`;

  const result = await client.requestData(process.env.UITKERING_API_URL, body, {
    'Content-type': 'text/xml',
    'SoapAction': process.env.UITKERING_API_URL + '/getData',
  });
  console.debug(result);
  expect(result).toContain('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">');
});