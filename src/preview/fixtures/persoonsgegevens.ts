import { Persoonsgegevens } from '../../app/persoonsgegevens/Persoonsgegevens';

export const persoonsgegevensData: Persoonsgegevens = {
  bsn: '999993653',
  naam: 'S. Holmes',
  voorletters: 'S.',
  voornamen: 'Sherlock',
  voorvoegsel: '',
  geslachtsnaam: 'Holmes',
  geboortedatum: '1 december 1854',
  nederlandseNationaliteit: 'Nee',
  geslacht: 'V',
  adresregels: ['Baker Street 221B', '1234AB Amsterdam'],
};

export const contactgegevensData = {
  email: 's.holmes@example.com',
  telefoonnummer: '0612345678',
};

export const editContactgegevensData = {
  type: 'email',
  isEmail: true,
  isPhone: false,
  currentValue: 's.holmes@example.com',
  xsrf_token: 'preview-token',
};
