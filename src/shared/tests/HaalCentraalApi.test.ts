import { Bsn } from '@gemeentenijmegen/utils';
import { ApiClient } from '../ApiClient';
import { HaalCentraalApi } from '../HaalCentraalApi';

describe('Haal Centraal API', () => {

  test('Error on overlijden', async () => {

    const client = new ApiClient({});
    const mockPostData = jest.fn().mockResolvedValueOnce({
      personen: [{
        overlijden: {
          datum: 'xxxx',
        },
      }],
    });
    client.postData = mockPostData;

    const api = new HaalCentraalApi({
      apiclient: client,
      baseUrl: 'https://example.com',
    });
    const result = api.getName(new Bsn('900026236'));
    expect(client.postData).toHaveBeenCalledTimes(1);
    await expect(result).rejects.toThrow('Persoon lijkt overleden');
  });

  test('Get naam', async () => {

    const client = new ApiClient({});
    const mockPostData = jest.fn().mockResolvedValueOnce({
      personen: [{
        naam: {
          voornamen: 'Pieter Jan',
          voorvoegsel: 'de',
          geslachtsnaam: 'Vries',
          voorletters: 'P.J.',
          volledigeNaam: 'Pieter Jan de Vries',
        },
        adressering: {
          aanschrijfwijze: 'P.J. de Vries',
        },
      }],
    });
    client.postData = mockPostData;

    const api = new HaalCentraalApi({
      apiclient: client,
      baseUrl: 'https://example.com',
    });
    const result = await api.getName(new Bsn('900026236'));
    expect(client.postData).toHaveBeenCalledTimes(1);
    expect(result).toBe('P.J. de Vries');
  });

  test('Get data', async () => {

    const client = new ApiClient({});
    const mockPostData = jest.fn().mockResolvedValueOnce({
      personen: [{
        aNummer: '00000000',
        burgerservicenummer: '900026236',
        naam: {
          voornamen: 'Pieter Jan',
          voorvoegsel: 'de',
          geslachtsnaam: 'Vries',
          voorletters: 'P.J.',
          volledigeNaam: 'Pieter Jan de Vries',
        },
        leeftijd: 34,
      }],
    });
    client.postData = mockPostData;

    const api = new HaalCentraalApi({
      apiclient: client,
      baseUrl: 'https://example.com',
    });
    const result = await api.getBrpData(new Bsn('900026236'), [
      'aNummer', 'burgerservicenummer', 'naam', 'leeftijd',
    ]);
    expect(client.postData).toHaveBeenCalledTimes(1);
    expect(result.naam.voorletters).toBe('P.J.');
    expect(result.leeftijd).toBe(34);
    expect(result.burgerservicenummer).toBe('900026236');

  });

  test('Error on undefined response', async () => {
    const client = new ApiClient({});
    const mockPostData = jest.fn().mockResolvedValueOnce(undefined);
    client.postData = mockPostData;
    const api = new HaalCentraalApi({
      apiclient: client,
      baseUrl: 'https://example.com',
    });
    const result = api.getName(new Bsn('900026236'));
    await expect(result).rejects.toThrow();
  });

  test('Error on multiple presonen respone', async () => {
    const client = new ApiClient({});
    const mockPostData = jest.fn().mockResolvedValueOnce({
      personen: [{
        aNummer: '00000000',
        burgerservicenummer: '900026236',
        naam: {
          voornamen: 'Pieter Jan',
          voorvoegsel: 'de',
          geslachtsnaam: 'Vries',
          voorletters: 'P.J.',
          volledigeNaam: 'Pieter Jan de Vries',
        },
        leeftijd: 34,
      },
      {
        aNummer: '00000000',
        burgerservicenummer: '900026236',
        naam: {
          voornamen: 'Pieter Jan',
          voorvoegsel: 'de',
          geslachtsnaam: 'Vries',
          voorletters: 'P.J.',
          volledigeNaam: 'Pieter Jan de Vries',
        },
        leeftijd: 34,
      }],
    });
    client.postData = mockPostData;
    const api = new HaalCentraalApi({
      apiclient: client,
      baseUrl: 'https://example.com',
    });
    const result = api.getName(new Bsn('900026236'));
    await expect(result).rejects.toThrow();
  });

});