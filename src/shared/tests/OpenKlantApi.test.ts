import { ApiClient } from '../ApiClient';
import { OpenKlantApi } from '../OpenKlantApi';

describe('OpenKlantApi', () => {
  let mockApiClient: jest.Mocked<ApiClient>;
  let openKlantApi: OpenKlantApi;

  beforeEach(() => {
    mockApiClient = {
      getData: jest.fn(),
      postData: jest.fn(),
      putData: jest.fn(),
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
        _expand: {
          digitaleAdressen: [
            { uuid: 'email-uuid', url: 'https://example.com/email', adres: 'test@example.com', soortDigitaalAdres: 'email', verstrektDoorPartij: { uuid: 'test-uuid', url: 'https://example.com/partij' } },
            { uuid: 'phone-uuid', url: 'https://example.com/phone', adres: '0612345678', soortDigitaalAdres: 'telefoonnummer', verstrektDoorPartij: { uuid: 'test-uuid', url: 'https://example.com/partij' } },
          ],
        },
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
        _expand: {
          digitaleAdressen: [
            { uuid: 'email-uuid', url: 'https://example.com/email', adres: 'info@company.com', soortDigitaalAdres: 'email', verstrektDoorPartij: { uuid: 'test-uuid', url: 'https://example.com/partij' } },
          ],
        },
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
        _expand: {
          digitaleAdressen: [
            { uuid: 'email1-uuid', url: 'https://example.com/email1', adres: 'first@example.com', soortDigitaalAdres: 'email', verstrektDoorPartij: { uuid: 'test-uuid', url: 'https://example.com/partij' } },
            { uuid: 'email2-uuid', url: 'https://example.com/email2', adres: 'second@example.com', soortDigitaalAdres: 'email', verstrektDoorPartij: { uuid: 'test-uuid', url: 'https://example.com/partij' } },
            { uuid: 'phone1-uuid', url: 'https://example.com/phone1', adres: '0611111111', soortDigitaalAdres: 'telefoonnummer', verstrektDoorPartij: { uuid: 'test-uuid', url: 'https://example.com/partij' } },
            { uuid: 'phone2-uuid', url: 'https://example.com/phone2', adres: '0622222222', soortDigitaalAdres: 'telefoonnummer', verstrektDoorPartij: { uuid: 'test-uuid', url: 'https://example.com/partij' } },
          ],
        },
      }],
    });

    const result = await openKlantApi.getContactInfo('900222670', 'person');

    expect(result.email).toBe('first@example.com');
    expect(result.phonenumber).toBe('0611111111');
  });

  test('updateContactInfo updates existing email and phone', async () => {
    mockApiClient.getData.mockResolvedValue({
      count: 1,
      results: [{
        uuid: 'partij-uuid',
        _expand: {
          digitaleAdressen: [
            { uuid: 'email-uuid', url: 'https://example.com/email', adres: 'old@example.com', soortDigitaalAdres: 'email', verstrektDoorPartij: { uuid: 'partij-uuid', url: 'https://example.com/partij' } },
            { uuid: 'phone-uuid', url: 'https://example.com/phone', adres: '0611111111', soortDigitaalAdres: 'telefoonnummer', verstrektDoorPartij: { uuid: 'partij-uuid', url: 'https://example.com/partij' } },
          ],
        },
      }],
    });

    await openKlantApi.updateContactInfo('900222670', 'person', { email: 'new@example.com', phonenumber: '0622222222' });

    expect(mockApiClient.putData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/digitaleadressen/email-uuid',
      { adres: 'new@example.com', soortDigitaalAdres: 'email', verstrektDoorPartij: { uuid: 'partij-uuid' }, verstrektDoorBetrokkene: null },
      { 'Content-Type': 'application/json' },
    );
    expect(mockApiClient.putData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/digitaleadressen/phone-uuid',
      { adres: '0622222222', soortDigitaalAdres: 'telefoonnummer', verstrektDoorPartij: { uuid: 'partij-uuid' }, verstrektDoorBetrokkene: null },
      { 'Content-Type': 'application/json' },
    );
  });

  test('updateContactInfo creates new email and phone when not existing', async () => {
    mockApiClient.getData.mockResolvedValue({
      count: 1,
      results: [{
        uuid: 'partij-uuid',
        _expand: {
          digitaleAdressen: [],
        },
      }],
    });

    await openKlantApi.updateContactInfo('900222670', 'person', { email: 'new@example.com', phonenumber: '0622222222' });

    expect(mockApiClient.postData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/digitaleadressen',
      { adres: 'new@example.com', soortDigitaalAdres: 'email', verstrektDoorPartij: { uuid: 'partij-uuid' }, verstrektDoorBetrokkene: null },
      { 'Content-Type': 'application/json' },
    );
    expect(mockApiClient.postData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/digitaleadressen',
      { adres: '0622222222', soortDigitaalAdres: 'telefoonnummer', verstrektDoorPartij: { uuid: 'partij-uuid' }, verstrektDoorBetrokkene: null },
      { 'Content-Type': 'application/json' },
    );
  });

  test('updateContactInfo creates new partij when not found', async () => {
    mockApiClient.getData.mockResolvedValue({
      count: 0,
      results: [],
    });
    mockApiClient.postData.mockResolvedValue({ uuid: 'new-partij-uuid' });

    await openKlantApi.updateContactInfo('900222670', 'person', { email: 'test@example.com' });

    expect(mockApiClient.postData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/partijen',
      {
        soortPartij: 'persoon',
        indicatieActief: true,
        digitaleAdressen: [],
        voorkeursDigitaalAdres: null,
        rekeningnummers: [],
        voorkeursRekeningnummer: null,
        partijIdentificatie: {
          contactnaam: null,
        },
      },
      { 'Content-Type': 'application/json' },
    );
    expect(mockApiClient.postData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/partij-identificatoren',
      {
        identificeerdePartij: { uuid: 'new-partij-uuid' },
        partijIdentificator: { objectId: '900222670', codeSoortObjectId: 'bsn' },
      },
      { 'Content-Type': 'application/json' },
    );
    expect(mockApiClient.postData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/digitaleadressen',
      { adres: 'test@example.com', soortDigitaalAdres: 'email', verstrektDoorPartij: { uuid: 'new-partij-uuid' }, verstrektDoorBetrokkene: null },
      { 'Content-Type': 'application/json' },
    );
  });
});
