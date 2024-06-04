import { Bsn } from '@gemeentenijmegen/utils';
import { Person, Organisation } from '../User';

describe('User types', () => {
  test('Creating users works', async() => {
    expect(new Person(new Bsn('900222670'), 'neptoken')).toBeTruthy();
    expect(new Organisation('69599084', 'neptoken')).toBeTruthy();
  });

  test('Organisations identify as such', async() => {
    const organisation = new Organisation('69599084', 'neptoken');
    expect(organisation.identifier).toBe('69599084');
    expect(organisation.type).toBe('organisation');
  });

  test('Persons identify as such', async() => {
    const person = new Person(new Bsn('900222670'), 'neptoken');
    expect(person.identifier).toBe('900222670');
    expect(person.type).toBe('person');
  });
});
