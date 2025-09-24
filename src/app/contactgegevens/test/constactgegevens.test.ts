import { Bsn } from '@gemeentenijmegen/utils';
import { Person, User } from '../../zaken/User';
import { ContactgegevensService } from '../ContactgegevensService';
import { IOpenKlantAPI, SoortDigitaalAdres } from '../OpenKlantApi';

describe('ContactgegevensService', () => {
  let mockOpenKlant: jest.Mocked<IOpenKlantAPI>;
  let service: ContactgegevensService;

  const baseUser = new Person(new Bsn('999999333'), undefined, undefined, 'John Doe');

  beforeEach(() => {
    mockOpenKlant = {
      getPartijWithDigitaleAdresen: jest.fn(),
      createNatuurlijkPersoon: jest.fn(),
      addPartijIdentificatie: jest.fn(),
      deleteDigitaalAdress: jest.fn(),
      updateDigitaalAdress: jest.fn(),
      createDigitaalAdress: jest.fn(),
      updatePartij: jest.fn(),
    } as any;

    service = new ContactgegevensService(mockOpenKlant);
  });

  describe('getContactgegevens', () => {
    it('throws error for organisation user', async () => {
      const orgUser = { type: 'organisation' } as User;
      await expect(service.getContactgegevens(orgUser)).rejects.toThrow(
        'Not implemented for organizations yet',
      );
    });

    it('returns empty object if no partij found', async () => {
      mockOpenKlant.getPartijWithDigitaleAdresen.mockResolvedValueOnce(undefined);

      const result = await service.getContactgegevens(baseUser);
      expect(result).toEqual({});
    });

    it('maps partij digitale adressen correctly', async () => {
      const partij = {
        uuid: 'p1',
        soortPartij: 'natuurlijkPersoon',
        _expand: {
          digitaleAdressen: [
            { uuid: 'e1', soortDigitaalAdres: 'email', adres: 'a@example.com' },
            { uuid: 't1', soortDigitaalAdres: 'telefoonnummer', adres: '12345' },
          ],
        },
        voorkeursDigitaalAdres: { uuid: 'e1' },
      };

      mockOpenKlant.getPartijWithDigitaleAdresen.mockResolvedValueOnce(partij as any);

      const result = await service.getContactgegevens(baseUser);
      expect(result).toEqual({
        email: 'a@example.com',
        telefoonnummer: '12345',
        voorkeur: 'email',
      });
    });
  });

  describe('updateDigitaalAdres', () => {
    const partij = {
      uuid: 'p1',
      soortPartij: 'natuurlijkPersoon',
      _expand: { digitaleAdressen: [] },
    };

    it('creates new digitaal adres if none exists', async () => {
      mockOpenKlant.createDigitaalAdress.mockResolvedValueOnce({ uuid: 'new1' } as any);

      const result = await service.updateDigitaalAdres(partij as any, SoortDigitaalAdres.EMAIL, 'x@example.com');
      expect(mockOpenKlant.createDigitaalAdress).toHaveBeenCalledWith('p1', SoortDigitaalAdres.EMAIL, 'x@example.com');
      expect(result).toEqual({ uuid: 'new1' });
    });

    it('updates existing digitaal adres', async () => {
      const partijWithEmail = {
        ...partij,
        _expand: {
          digitaleAdressen: [{ uuid: 'e1', soortDigitaalAdres: 'email', adres: 'old@example.com' }],
        },
      };
      mockOpenKlant.updateDigitaalAdress.mockResolvedValueOnce({ uuid: 'e1', adres: 'new@example.com' } as any);

      const result = await service.updateDigitaalAdres(partijWithEmail as any, SoortDigitaalAdres.EMAIL, 'new@example.com');
      expect(mockOpenKlant.updateDigitaalAdress).toHaveBeenCalledWith('e1', 'new@example.com');
      expect(result).toEqual({ uuid: 'e1', adres: 'new@example.com' });
    });

    it('deletes existing digitaal adres when value is undefined', async () => {
      const partijWithEmail = {
        ...partij,
        _expand: {
          digitaleAdressen: [{ uuid: 'e1', soortDigitaalAdres: 'email', adres: 'old@example.com' }],
        },
      };

      await service.updateDigitaalAdres(partijWithEmail as any, SoortDigitaalAdres.EMAIL, undefined);
      expect(mockOpenKlant.deleteDigitaalAdress).toHaveBeenCalledWith('e1');
    });

    it('does nothing if no value and no existing adres', async () => {
      const result = await service.updateDigitaalAdres(partij as any, SoortDigitaalAdres.EMAIL, undefined);
      expect(result).toBeUndefined();
      expect(mockOpenKlant.deleteDigitaalAdress).not.toHaveBeenCalled();
    });
  });

  describe('updateContactgegevensNatuurlijkPersoon', () => {
    it('creates partij if not exists', async () => {
      mockOpenKlant.getPartijWithDigitaleAdresen.mockResolvedValueOnce(undefined);
      mockOpenKlant.createNatuurlijkPersoon.mockResolvedValueOnce({ uuid: 'p1' } as any);

      await service.updateContactgegevensNatuurlijkPersoon(baseUser, { email: 'a@example.com' });

      expect(mockOpenKlant.createNatuurlijkPersoon).toHaveBeenCalledWith('John Doe');
      expect(mockOpenKlant.addPartijIdentificatie).toHaveBeenCalledWith(baseUser, 'p1');
    });
  });
});

