import { Navigation } from '../Navigation';
describe('Navigation construction', () => {
  test('Regular navigation retrieves 3 items', async () => {
    const navigation = new Navigation('person');
    expect(navigation.items).toHaveLength(3);
  });
  test('Organisation navigation retrieves no items', async () => {
    const navigation = new Navigation('organisation');
    expect(navigation.items).toHaveLength(1);
  });

  test('Organisation navigation with zaken retrieves 1 item', async () => {
    const navigation = new Navigation('organisation', { showZaken: true });
    expect(navigation.items).toHaveLength(2);
  });

  test('Person navigation with zaken retrieves 3 item', async () => {
    const navigation = new Navigation('person', { showZaken: true });
    expect(navigation.items).toHaveLength(4);
  });
});
