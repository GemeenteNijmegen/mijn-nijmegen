import { describe, expect, it } from 'vitest';
import { BreadCrumbs } from '../Navigation';

interface NavigationItem {
  url: string;
  title: string;
}

describe('BreadCrumbs', () => {
  describe('constructor', () => {
    it('should set items to false when given an empty array', () => {
      const breadcrumbs = new BreadCrumbs([]);

      expect(breadcrumbs.items).toBe(false);
    });

    it('should set items to false when given a single item', () => {
      const navItem: NavigationItem = { url: '/home', title: 'Home' };
      const breadcrumbs = new BreadCrumbs([navItem]);

      expect(breadcrumbs.items).toBe(false);
    });

    it('should set previous and current when given exactly two items', () => {
      const navItem1: NavigationItem = { url: '/home', title: 'Home' };
      const navItem2: NavigationItem = { url: '/about', title: 'About' };
      const breadcrumbs = new BreadCrumbs([navItem1, navItem2]);

      expect(breadcrumbs.items).not.toBe(false);
      if (breadcrumbs.items !== false) {
        expect(breadcrumbs.items.previous).toBe(navItem1);
        expect(breadcrumbs.items.current).toBe(navItem2);
        expect(breadcrumbs.items.items).toEqual([navItem1]);
        expect(breadcrumbs.items.items).toHaveLength(1);
      }
    });

    it('should correctly set previous, current, and items with three navigation items', () => {
      const navItem1: NavigationItem = { url: '/home', title: 'Home' };
      const navItem2: NavigationItem = { url: '/products', title: 'Products' };
      const navItem3: NavigationItem = { url: '/products/shoes', title: 'Shoes' };

      const breadcrumbs = new BreadCrumbs([navItem1, navItem2, navItem3]);

      expect(breadcrumbs.items).not.toBe(false);
      if (breadcrumbs.items !== false) {
        expect(breadcrumbs.items.previous).toBe(navItem2);
        expect(breadcrumbs.items.current).toBe(navItem3);
        expect(breadcrumbs.items.items).toEqual([navItem1, navItem2]);
        expect(breadcrumbs.items.items).toHaveLength(2);
      }
    });

    it('should correctly set previous, current, and items with multiple navigation items', () => {
      const navItem1: NavigationItem = { url: '/home', title: 'Home' };
      const navItem2: NavigationItem = { url: '/products', title: 'Products' };
      const navItem3: NavigationItem = { url: '/products/shoes', title: 'Shoes' };
      const navItem4: NavigationItem = { url: '/products/shoes/nike', title: 'Nike' };
      const navItem5: NavigationItem = { url: '/products/shoes/nike/air-max', title: 'Air Max' };

      const breadcrumbs = new BreadCrumbs([navItem1, navItem2, navItem3, navItem4, navItem5]);

      expect(breadcrumbs.items).not.toBe(false);
      if (breadcrumbs.items !== false) {
        expect(breadcrumbs.items.previous).toBe(navItem4);
        expect(breadcrumbs.items.current).toBe(navItem5);
        expect(breadcrumbs.items.items).toEqual([navItem1, navItem2, navItem3, navItem4]);
        expect(breadcrumbs.items.items).toHaveLength(4);
      }
    });

    it('should mutate the original array by removing the last item', () => {
      const navItem1: NavigationItem = { url: '/home', title: 'Home' };
      const navItem2: NavigationItem = { url: '/about', title: 'About' };
      const navItem3: NavigationItem = { url: '/contact', title: 'Contact' };
      const testArray = [navItem1, navItem2, navItem3];

      const breadcrumbs = new BreadCrumbs(testArray);

      // The original array is mutated (last item removed by pop())
      expect(testArray).toEqual([navItem1, navItem2]);
      expect(testArray.length).toBe(2);

      // But the items array in breadcrumbs.items still contains all except last
      if (breadcrumbs.items !== false) {
        expect(breadcrumbs.items.items).toEqual([navItem1, navItem2]);
      }
    });

    it('should have items array without the last element after construction', () => {
      const navItem1: NavigationItem = { url: '/home', title: 'Home' };
      const navItem2: NavigationItem = { url: '/products', title: 'Products' };
      const navItem3: NavigationItem = { url: '/products/shoes', title: 'Shoes' };

      const breadcrumbs = new BreadCrumbs([navItem1, navItem2, navItem3]);

      if (breadcrumbs.items !== false) {
        expect(breadcrumbs.items.items).toHaveLength(2);
        expect(breadcrumbs.items.items).not.toContain(navItem3);
        expect(breadcrumbs.items.items).toContain(navItem1);
        expect(breadcrumbs.items.items).toContain(navItem2);
      }
    });

    it('should correctly identify previous item as second to last', () => {
      const navItem1: NavigationItem = { url: '/home', title: 'Home' };
      const navItem2: NavigationItem = { url: '/products', title: 'Products' };
      const navItem3: NavigationItem = { url: '/products/shoes', title: 'Shoes' };

      const breadcrumbs = new BreadCrumbs([navItem1, navItem2, navItem3]);

      if (breadcrumbs.items !== false) {
        expect(breadcrumbs.items.previous.url).toBe('/products');
        expect(breadcrumbs.items.previous.title).toBe('Products');
      }
    });

    it('should correctly identify current item as last', () => {
      const navItem1: NavigationItem = { url: '/home', title: 'Home' };
      const navItem2: NavigationItem = { url: '/products', title: 'Products' };
      const navItem3: NavigationItem = { url: '/products/shoes', title: 'Shoes' };

      const breadcrumbs = new BreadCrumbs([navItem1, navItem2, navItem3]);

      if (breadcrumbs.items !== false) {
        expect(breadcrumbs.items.current.url).toBe('/products/shoes');
        expect(breadcrumbs.items.current.title).toBe('Shoes');
      }
    });
  });
});
