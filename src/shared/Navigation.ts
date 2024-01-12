import { MdiAccount, MdiCurrencyEur, MdiFileMultiple } from './Icons';

interface NavigationItem {
  url: string;
  title: string;
  description: string;
  label: string;
  icon: string;
}
export class Navigation {
  personItems = [
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

  organisationItems: NavigationItem[] = [];

  sharedItems: NavigationItem[] = [];

  zakenItem = {
    url: '/zaken',
    title: 'Zaken',
    description: 'Bekijk de status van uw zaken en aanvragen. Nog niet alle zaken zijn te zien, we breiden dit uit.',
    label: 'Bekijk zaken',
    icon: MdiFileMultiple.default,
  };

  items: NavigationItem[];

  constructor(navigationType: 'person' | 'organisation', config?: { showZaken?: boolean }) {
    if (config?.showZaken) {
      this.sharedItems.push(this.zakenItem);
    }

    if (navigationType == 'person') {
      this.items = [...this.personItems, ...this.sharedItems];
    } else {
      this.items = [...this.organisationItems, ...this.sharedItems];
    }
  }
}
