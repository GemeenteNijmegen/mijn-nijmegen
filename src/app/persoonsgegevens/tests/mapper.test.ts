import { PersoonsgegevensMapper } from '../Persoonsgegevens';

describe('Geboortedatum mapping', () => {

  test('to dutch', () => {
    const input = '1950-09-19';
    const expected = '19-09-1950';
    expect(PersoonsgegevensMapper.isoDateToDutchFormat(input)).toBe(expected);
  });

  test('unknown', () => {
    const input = '0000-00-00';
    const expected = '00-00-0000';
    expect(PersoonsgegevensMapper.isoDateToDutchFormat(input)).toBe(expected);
  });

  test('unknown month and day', () => {
    const input = '1950-00-00';
    const expected = '00-00-1950';
    expect(PersoonsgegevensMapper.isoDateToDutchFormat(input)).toBe(expected);
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
