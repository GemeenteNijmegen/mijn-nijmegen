import { PersoonsgegevensMapper } from '../Persoonsgegevens';

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
