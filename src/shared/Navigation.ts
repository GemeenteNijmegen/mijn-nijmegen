import { MdiAccount, MdiCurrencyEur, MdiFileMultiple, MdiOverview } from './Icons';

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
      priority: 20,
      url: '/persoonsgegevens',
      title: 'Persoonsgegevens',
      description: 'Bekijk uw persoons- en adresgegevens.',
      label: 'Bekijk mijn persoonsgegevens',
      icon: MdiAccount.default,
    }, {
      priority: 40,
      url: '/uitkeringen',
      title: 'Uitkeringen',
      description: 'Bekijk uw uitkeringsgegevens.',
      label: 'Bekijk mijn uitkeringen',
      icon: MdiCurrencyEur.default,
    },
  ];

  organisationItems: NavigationItem[] = [];

  sharedItems: NavigationItem[] = [{
    priority: 10,
    url: '/',
    title: 'Overzicht',
    description: 'Bekijk de overzichtspagina',
    label: 'Bekijk de overzichtspagina',
    icon: MdiOverview.default,
  }];

  zakenItem = {
    priority: 30,
    url: '/zaken',
    title: 'Zaken',
    description: 'Bekijk de status van uw zaken en aanvragen. Nog niet alle zaken zijn te zien, we breiden dit uit.',
    label: 'Bekijk zaken',
    icon: MdiFileMultiple.default,
  };

  items: NavigationItem[];

  constructor(navigationType: 'person' | 'organisation', config?: { showZaken?: boolean; currentPath: string }) {
    if (config?.showZaken) {
      this.sharedItems.push(this.zakenItem);
    }

    if (navigationType == 'person') {
      this.items = [...this.personItems, ...this.sharedItems];
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
