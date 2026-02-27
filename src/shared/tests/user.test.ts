import { Bsn } from '@gemeentenijmegen/utils';
import { Organisation, Person } from '../User';

describe('User types', () => {
  test('Creating users works', async () => {
    expect(new Person(new Bsn('900222670'), undefined, 'N. Boedoe')).toBeTruthy();
    expect(new Organisation('69599084', 'Bedrijfsnaam')).toBeTruthy();
  });

  test('Organisations identify as such', async () => {
    const organisation = new Organisation('69599084', 'bedrijfsnaam');
    expect(organisation.identifier).toBe('69599084');
    expect(organisation.type).toBe('organisation');
  });

  test('Persons identify as such', async () => {
    const person = new Person(new Bsn('900222670'), undefined, 'username');
    expect(person.identifier).toBe('900222670');
    expect(person.type).toBe('person');
  });

  test('Person can have email and phonenumber', async () => {
    const person = new Person(new Bsn('900222670'), undefined, 'username', 'test@example.com', '0612345678');
    expect(person.email).toBe('test@example.com');
    expect(person.phonenumber).toBe('0612345678');
  });

  test('Organisation can have email and phonenumber', async () => {
    const organisation = new Organisation('69599084', 'bedrijfsnaam', 'info@example.com', '0612345678');
    expect(organisation.email).toBe('info@example.com');
    expect(organisation.phonenumber).toBe('0612345678');
  });

  test('Email and phonenumber are optional', async () => {
    const person = new Person(new Bsn('900222670'), undefined, 'username');
    expect(person.email).toBeUndefined();
    expect(person.phonenumber).toBeUndefined();

    const organisation = new Organisation('69599084', 'bedrijfsnaam');
    expect(organisation.email).toBeUndefined();
    expect(organisation.phonenumber).toBeUndefined();
  });
});
