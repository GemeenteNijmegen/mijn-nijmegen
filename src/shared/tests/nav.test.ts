import { Navigation } from '../Navigation';
describe('Navigation construction', () => {
  test('Regular navigation retrieves 3 items', async () => {
    const navigation = new Navigation('person');
    expect(navigation.items).toHaveLength(3);
  });
  test('Organisation navigation retrieves 1 item', async () => {
    const navigation = new Navigation('organisation');
    expect(navigation.items).toHaveLength(1);
  });

  test('Organisation navigation with zaken retrieves 2 items', async () => {
    const navigation = new Navigation('organisation', { showZaken: true, currentPath: '/' });
    expect(navigation.items).toHaveLength(2);
  });

  test('Person navigation with zaken retrieves 4 item', async () => {
    const navigation = new Navigation('person', { showZaken: true, currentPath: '/' });
    expect(navigation.items).toHaveLength(4);
  });

  test('Navigation is ordered correctly', async () => {
    const navigation = new Navigation('person', { showZaken: true, currentPath: '/' });
    expect(navigation.items[0].title).toBe('Overzicht');
    expect(navigation.items[0].current).toBeTruthy();
  });

  test('Current item is marked', async () => {
    const navigation = new Navigation('person', { showZaken: true, currentPath: '/' });
    expect(navigation.items[0].current).toBeTruthy();
    expect(navigation.items[1].current).toBeFalsy();
  });
});
