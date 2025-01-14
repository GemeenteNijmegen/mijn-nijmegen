import { ApiClient } from "@gemeentenijmegen/apiclient";
import { HaalCentraalApi } from "../HaalCentraalApi";

// Mocking the entire class
jest.mock('@gemeentenijmegen/apiclient', () => {
  return {
    ApiClient: jest.fn().mockImplementation(() => ({
      init: jest.fn(),
      getPrivateKey: jest.fn(),
      getParameterValue: jest.fn(),
      requestData: jest.fn(),
      postData: jest.fn(),
      getData: jest.fn(),
      setupAgent: jest.fn(),
    })),
  };
});

describe('Haal Centraal API', () => {


  test('Error on overlijden', async () => {

    const client = new ApiClient();
    (client.postData as jest.Mock).mockResolvedValueOnce({
      personen: [{
        overlijden: {
          datum: 'xxxx',
        }
      }]
    });

    const api = new HaalCentraalApi(client, '123', 'https://example.com');
    const result = await api.getNaam('900026236');
    expect(client.postData).toHaveBeenCalledTimes(1);
    expect(result.error).toBeTruthy()
  });

  test('Get naam', async () => {

    const client = new ApiClient();
    (client.postData as jest.Mock).mockResolvedValueOnce({
      personen: [{
        "naam": {
          "voornamen": "Pieter Jan",
          "voorvoegsel": "de",
          "geslachtsnaam": "Vries",
          "voorletters": "P.J.",
          "volledigeNaam": "Pieter Jan de Vries",
        },
      }]
    });

    const api = new HaalCentraalApi(client, '123', 'https://example.com');
    const result = await api.getNaam('900026236');
    expect(client.postData).toHaveBeenCalledTimes(1);
    expect(result).toBe("Pieter Jan de Vries");
  });

  test('Get data', async () => {

    const client = new ApiClient();
    (client.postData as jest.Mock).mockResolvedValueOnce({
      personen: [{
        "aNummer": "00000000",
        "burgerservicenummer": "900026236",
        "naam": {
          "voornamen": "Pieter Jan",
          "voorvoegsel": "de",
          "geslachtsnaam": "Vries",
          "voorletters": "P.J.",
          "volledigeNaam": "Pieter Jan de Vries",
        },
        "leeftijd": 34,
      }]
    });

    const api = new HaalCentraalApi(client, '123', 'https://example.com');
    const result = await api.getBrpData('900026236');
    expect(client.postData).toHaveBeenCalledTimes(1);
    expect(result.naam.voorletters).toBe("P.J.");
    expect(result.leeftijd).toBe(34);
    expect(result.burgerservicenummer).toBe("900026236");

  });

});