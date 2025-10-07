import { MdiAccount, MdiAddressBook, MdiCurrencyEur, MdiFileMultiple, MdiOverview, Tasks } from './Icons';

interface NavigationItem {
  priority: number; // Sort based on priority
  url: string;
  title: string;
  description: string;
  label: string;
  icon: string;
  current?: boolean;
}
export class Navigation {
  personItems = [
    {
      priority: 40,
      url: '/persoonsgegevens',
      title: 'Mijn gegevens',
      description: 'Bekijk uw persoons- en adresgegevens.',
      label: 'Bekijk mijn persoonsgegevens',
      icon: MdiAccount.default,
    }, {
      priority: 50,
      url: '/uitkeringen',
      title: 'Mijn uitkeringen',
      description: 'Bekijk uw uitkeringsgegevens.',
      label: 'Bekijk mijn uitkeringen',
      icon: MdiCurrencyEur.default,
    },
  ];

  contactgegevens: NavigationItem = {
    priority: 60,
    url: '/contactgegevens',
    title: 'Mijn contactgegevens',
    description: 'Beheer uw contactgegevens.',
    label: 'Beheer mijn contactgegevens',
    icon: MdiAddressBook.default,
  };

  producten: NavigationItem = {
    priority: 70,
    url: '/producten',
    title: 'Mijn producten',
    description: 'Bekijk uw producten.',
    label: 'Bekijk uw producten',
    icon: MdiAddressBook.default,
  };


  organisationItems: NavigationItem[] = [];

  sharedItems: NavigationItem[] = [{
    priority: 10,
    url: '/',
    title: 'Overzicht',
    description: 'Bekijk de overzichtspagina',
    label: 'Bekijk de overzichtspagina',
    icon: MdiOverview.default,
  },{
    priority: 20,
    url: '/taken',
    title: 'Mijn taken',
    description: 'Bekijk uw taken.',
    label: 'Bekijk taken',
    icon: Tasks.default,
  },
  {
    priority: 30,
    url: '/zaken',
    title: 'Mijn zaken',
    description: 'Bekijk de status van uw zaken en aanvragen. Nog niet alle zaken zijn te zien, we breiden dit uit.',
    label: 'Bekijk zaken',
    icon: MdiFileMultiple.default,
  }];

  items: NavigationItem[];

  constructor(navigationType: 'person' | 'organisation', config?: { currentPath: string; showContactgegevens?: boolean; showProducten?: boolean }) {
    if (navigationType == 'person') {
      this.items = [...this.personItems, ...this.sharedItems];
      if (config?.showContactgegevens) {
        this.items.push(this.contactgegevens);
      }
      if (config?.showProducten) {
        this.items.push(this.producten);
      }
    } else {
      this.items = [...this.organisationItems, ...this.sharedItems];
    }
    this.items = this.items
      .sort((a:NavigationItem, b: NavigationItem) => a.priority - b.priority)
      .map((item: NavigationItem) => {
        if (item.url == config?.currentPath) { item.current = true; }
        return item;
      });
  }
}
