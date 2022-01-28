import { UitkeringsApi, FileConnector } from '../UitkeringsApi';
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
  console.debug(JSON.stringify(result));
});