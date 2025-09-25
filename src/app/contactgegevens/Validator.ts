import validator from 'validator';
import { VoorkeurSchema } from './ContactgegevensService';
import { ErrorFlags } from './RenderingService';
import { RequestParameters } from './RequestHandler';

export class RequestValidator {

  static validate(params: RequestParameters) {
    const errors: ErrorFlags = {};

    const voorkeur = params.voorkeur ? VoorkeurSchema.parse(params.voorkeur) : undefined;

    if (params.email && !validator.isEmail(params.email)) {
      errors.invalidEmail = true;
    }
    if (params.telefoonnummer && !validator.isMobilePhone(params.telefoonnummer) && !RequestValidator.isValidPhonenumber(params.telefoonnummer)) {
      errors.invalidTelefoon = true;
    }
    if (!params.telefoonnummer && voorkeur == 'telefoon') {
      errors.voorkeurTelefoonlMaarGeenTelefoon = true;
    }
    if (!params.email && voorkeur == 'email') {
      errors.voorkeurEmailMaarGeenEmail = true;
    }
    return errors;
  }

  static hasErrors(errors: ErrorFlags) {
    return Object.values(errors).find(val => val === true) != undefined;
  }

  /**
   * Validates a phoone number using the open-klant regex for phonenumbers
   * @param phonenumber
   * @returns
   */
  static isValidPhonenumber(phonenumber: string) {
    const regex = /^(0[8-9]00[0-9]{4,7})|(0[1-9][0-9]{8})|(\+[0-9]{9,20}|1400|140[0-9]{2,3})$/;
    return regex.test(phonenumber);
  }

}