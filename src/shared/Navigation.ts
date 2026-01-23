import { MdiAccount, MdiAddressBook, MdiCurrencyEur, MdiFileMultiple, MdiOverview, Tasks } from './Icons';

interface NavigationItem {
  url: string;
  title: string;
}
interface MenuBarNavigationItem extends NavigationItem {
  priority: number; // Sort based on priority
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

  contactgegevens: MenuBarNavigationItem = {
    priority: 60,
    url: '/contactgegevens',
    title: 'Mijn contactgegevens',
    description: 'Beheer uw contactgegevens.',
    label: 'Beheer mijn contactgegevens',
    icon: MdiAddressBook.default,
  };

  producten: MenuBarNavigationItem = {
    priority: 70,
    url: '/producten',
    title: 'Mijn producten',
    description: 'Bekijk uw producten.',
    label: 'Bekijk uw producten',
    icon: MdiAddressBook.default,
  };


  organisationItems: MenuBarNavigationItem[] = [];

  sharedItems: MenuBarNavigationItem[] = [{
    priority: 10,
    url: '/',
    title: 'Overzicht',
    description: 'Bekijk de overzichtspagina',
    label: 'Bekijk de overzichtspagina',
    icon: MdiOverview.default,
  }, {
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

  items: MenuBarNavigationItem[];

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
      .sort((a: MenuBarNavigationItem, b: MenuBarNavigationItem) => a.priority - b.priority)
      .map((item: MenuBarNavigationItem) => {
        if (item.url == config?.currentPath) { item.current = true; }
        return item;
      });
  }
}

export class BreadCrumbs {
  items: { previous: NavigationItem; current: NavigationItem; items: NavigationItem[] } | false = false;
  constructor(items: NavigationItem[]) {
    if (items.length > 1) {
      const previous = items[items.length - 2];
      const current = items.pop()!;
      this.items = {
        previous,
        current,
        items,
      };
    }
  }
}
