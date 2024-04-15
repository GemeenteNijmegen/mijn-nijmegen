import { Bsn } from '@gemeentenijmegen/utils';
import { Person, Organisation } from '../User';

describe('User types', () => {
  test('Creating users works', async() => {
    expect(new Person(new Bsn('900222670'))).toBeTruthy();
    expect(new Organisation('69599084')).toBeTruthy();
  });

  test('Organisations identify as such', async() => {
    const organisation = new Organisation('69599084');
    expect(organisation.identifier).toBe('69599084');
    expect(organisation.type).toBe('organisation');
  });

  test('Persons identify as such', async() => {
    const person = new Person(new Bsn('900222670'));
    expect(person.identifier).toBe('900222670');
    expect(person.type).toBe('person');
  });
});
