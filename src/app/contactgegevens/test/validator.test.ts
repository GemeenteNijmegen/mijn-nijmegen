import { describe, test, expect } from 'vitest';
import { RequestValidator } from '../Validator';

describe('Validator tests', () => {

  test('Is valid phonenumber', () => {
    expect(RequestValidator.isValidPhonenumber('+31612343434')).toBe(true);
    expect(RequestValidator.isValidPhonenumber('0031612343434')).toBe(true);
    expect(RequestValidator.isValidPhonenumber('0241231232')).toBe(true);
    expect(RequestValidator.isValidPhonenumber('+316-312343434')).toBe(false);
    expect(RequestValidator.isValidPhonenumber('+31 6312 343 434')).toBe(false);
  });

  test('has errors', () => {
    expect(RequestValidator.hasErrors({
      generalError: true,
      invalidVerificationCode: false,
    })).toBe(true);
  });

  test('valid request', () => {
    const errors = RequestValidator.validate({
      cookies: '',
      method: 'POST',
      email: 'test@example.com',
      telefoonnummer: '06123123123',
      voorkeur: 'telefoon',
    });
    expect(RequestValidator.hasErrors(errors)).toBe(false);
  });

  test('invalid email', () => {
    const errors = RequestValidator.validate({
      cookies: '',
      method: 'POST',
      email: 'abc',
      telefoonnummer: '06123123123',
      voorkeur: 'telefoon',
    });
    expect(errors.invalidEmail).toBe(true);
  });

  test('invalid voorkeur', () => {
    expect(() => {
      RequestValidator.validate({
        cookies: '',
        method: 'POST',
        email: 'test@example.com',
        telefoonnummer: '06123123123',
        voorkeur: 'abc',
      });
    }).toThrow();
  });

  test('invalid phonenumber', () => {
    const errors = RequestValidator.validate({
      cookies: '',
      method: 'POST',
      email: 'test@example.com',
      telefoonnummer: '123123-123-123-',
      voorkeur: 'telefoon',
    });
    expect(errors.invalidTelefoon).toBe(true);
  });

  test('Remove all digitale adressen', () => {
    const errors = RequestValidator.validate({
      cookies: '',
      method: 'POST',
      email: undefined,
      telefoonnummer: undefined,
      voorkeur: undefined,
    });
    console.log(errors);
    expect(RequestValidator.hasErrors(errors)).toBe(false);
  });

  test('Voorkeur telefoon maar geen telefoon', () => {
    const errors = RequestValidator.validate({
      cookies: '',
      method: 'POST',
      email: 'test@example.com',
      telefoonnummer: undefined,
      voorkeur: 'telefoon',
    });
    expect(errors.voorkeurTelefoonlMaarGeenTelefoon).toBe(true);
  });

  test('Voorkeur email maar geen email', () => {
    const errors = RequestValidator.validate({
      cookies: '',
      method: 'POST',
      email: undefined,
      telefoonnummer: '024123123123',
      voorkeur: 'email',
    });
    expect(errors.voorkeurEmailMaarGeenEmail).toBe(true);
  });


});