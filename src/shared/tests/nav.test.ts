import { Navigation } from '../Navigation';
describe('Navigation construction', () => {
  test('Regular navigation retrieves 4 items', async () => {
    const navigation = new Navigation('person');
    expect(navigation.items).toHaveLength(4);
  });

  test('Organisation navigation retrieves 2 items', async () => {
    const navigation = new Navigation('organisation', { currentPath: '/' });
    expect(navigation.items).toHaveLength(2);
  });

  test('Navigation is ordered correctly', async () => {
    const navigation = new Navigation('person', { currentPath: '/' });
    expect(navigation.items[0].title).toBe('Overzicht');
    expect(navigation.items[0].current).toBeTruthy();
  });

  test('Current item is marked', async () => {
    const navigation = new Navigation('person', { currentPath: '/' });
    expect(navigation.items[0].current).toBeTruthy();
    expect(navigation.items[1].current).toBeFalsy();
  });
});
