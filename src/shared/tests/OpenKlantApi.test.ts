import { ApiClient } from '../ApiClient';
import { OpenKlantApi } from '../OpenKlantApi';

describe('OpenKlantApi', () => {
  let mockApiClient: jest.Mocked<ApiClient>;
  let openKlantApi: OpenKlantApi;

  beforeEach(() => {
    mockApiClient = {
      getData: jest.fn(),
    } as any;

    openKlantApi = new OpenKlantApi({
      baseUrl: 'https://example.com',
      apiclient: mockApiClient,
    });
  });

  test('getContactInfo for person returns email and phonenumber', async () => {
    mockApiClient.getData.mockResolvedValue({
      count: 1,
      results: [{
        uuid: 'test-uuid',
        digitaleAdressen: [
          { adres: 'test@example.com', soortDigitaalAdres: 'email' },
          { adres: '0612345678', soortDigitaalAdres: 'telefoonnummer' },
        ],
      }],
    });

    const result = await openKlantApi.getContactInfo('900222670', 'person');

    expect(result.email).toBe('test@example.com');
    expect(result.phonenumber).toBe('0612345678');
    expect(mockApiClient.getData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/partijen?partijIdentificator__codeSoortObjectId=bsn&partijIdentificator__objectId=900222670&expand=digitaleAdressen',
    );
  });

  test('getContactInfo for organisation uses kvk filter', async () => {
    mockApiClient.getData.mockResolvedValue({
      count: 1,
      results: [{
        uuid: 'test-uuid',
        digitaleAdressen: [
          { adres: 'info@company.com', soortDigitaalAdres: 'email' },
        ],
      }],
    });

    const result = await openKlantApi.getContactInfo('69599084', 'organisation');

    expect(result.email).toBe('info@company.com');
    expect(mockApiClient.getData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/partijen?partijIdentificator__codeSoortObjectId=kvk&partijIdentificator__objectId=69599084&expand=digitaleAdressen',
    );
  });

  test('getContactInfo returns empty object when no digitaleAdressen', async () => {
    mockApiClient.getData.mockResolvedValue({
      count: 1,
      results: [{
        uuid: 'test-uuid',
      }],
    });

    const result = await openKlantApi.getContactInfo('900222670', 'person');

    expect(result).toEqual({});
  });

  test('getContactInfo throws error when no partij found', async () => {
    mockApiClient.getData.mockResolvedValue({
      count: 0,
      results: [],
    });

    await expect(openKlantApi.getContactInfo('900222670', 'person')).rejects.toThrow('No partij found for identifier');
  });

  test('getContactInfo only returns first email and phonenumber', async () => {
    mockApiClient.getData.mockResolvedValue({
      count: 1,
      results: [{
        uuid: 'test-uuid',
        digitaleAdressen: [
          { adres: 'first@example.com', soortDigitaalAdres: 'email' },
          { adres: 'second@example.com', soortDigitaalAdres: 'email' },
          { adres: '0611111111', soortDigitaalAdres: 'telefoonnummer' },
          { adres: '0622222222', soortDigitaalAdres: 'telefoonnummer' },
        ],
      }],
    });

    const result = await openKlantApi.getContactInfo('900222670', 'person');

    expect(result.email).toBe('first@example.com');
    expect(result.phonenumber).toBe('0611111111');
  });
});
