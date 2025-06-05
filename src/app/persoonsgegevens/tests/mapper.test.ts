import { PersoonsgegevensMapper } from '../Persoonsgegevens';
import { responses } from './users';

describe('Adres mapping', () => {
  test('Regular address shows correctly', async() => {
    const response = PersoonsgegevensMapper.fromHaalCentraal(responses.regulier.personen[0]);
    expect(response.adresregels).toStrictEqual([
      'Anna van Saksenlaan 71',
      '2593 HW  \'S-GRAVENHAGE',
    ]);
  });

  test('Long foreign address shows correctly', async() => {
    const response = PersoonsgegevensMapper.fromHaalCentraal(responses.langestraatnaam.personen[0]);
    expect(response.adresregels).toStrictEqual([
      'Av. Vasco de Quiroga 3000/7',
      '01210 Mexico-Stad',
      'Edificio Calakmul, Colonia',
    ]);
  });

  test('Long foreign address shows correctly', async() => {
    const response = PersoonsgegevensMapper.fromHaalCentraal(responses.langestraatnaam.personen[0]);
    expect(response.adresregels).toStrictEqual([
      'Av. Vasco de Quiroga 3000/7',
      '01210 Mexico-Stad',
      'Edificio Calakmul, Colonia',
    ]);
  });

  test('locatieomschrijving shows correctly', async() => {
    const response = PersoonsgegevensMapper.fromHaalCentraal(responses.locatieomschrijving.personen[0]);
    expect(response.adresregels).toStrictEqual([
      'Droompark Havenzicht 12-34',
      'ROTTERDAM',
    ]);
    expect(response.nederlandseNationaliteit).toBe('Nee');
  });

  test('Behandeld als Nederlander returns correctly', async() => {
    const response = PersoonsgegevensMapper.fromHaalCentraal(responses.behandeldAlsNederlander.personen[0]);
    expect(response.nederlandseNationaliteit).toBe('Behandeld als Nederlander');
  });
});

describe('Nationaliteit', () => {

  const dutch =
  {
    type: 'Nationaliteit',
    nationaliteit: {
      code: '0001',
      omschrijving: 'Nederlandse',
    },
  };

  const indian = {
    type: 'Nationaliteit',
    nationaliteit: {
      code: '0312',
      omschrijving: 'Indiase',
    },
  };

  test('Empty', () => {
    expect(PersoonsgegevensMapper.hasNederlandseNationaliteit(undefined)).toBe('Nee');
  });

  test('With NL nationality', () => {
    expect(PersoonsgegevensMapper.hasNederlandseNationaliteit([dutch, indian])).toBe('Ja');
  });

  test('Without NL nationality', () => {
    expect(PersoonsgegevensMapper.hasNederlandseNationaliteit([indian])).toBe('Nee');
  });


});
