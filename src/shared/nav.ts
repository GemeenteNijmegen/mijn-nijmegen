import { MdiAccount, MdiCurrencyEur } from './Icons';

export const nav = [
  {
    url: '/persoonsgegevens',
    title: 'Persoonsgegevens',
    description: 'Bekijk uw persoons- en adresgegevens.',
    label: 'Bekijk mijn persoonsgegevens',
    icon: MdiAccount.default,
  }, {
    url: '/uitkeringen',
    title: 'Uitkeringen',
    description: 'Bekijk uw uitkeringsgegevens.',
    label: 'Bekijk mijn uitkeringen',
    icon: MdiCurrencyEur.default,
  },
];
