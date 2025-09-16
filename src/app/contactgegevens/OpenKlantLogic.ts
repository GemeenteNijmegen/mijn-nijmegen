import { User } from '../zaken/User';
import { OpenKlantDigitaalAdresWithUuid, OpenKlantPartijWithUuid } from './model/partij';
import { IOpenKlantAPI } from './OpenKlantApi';

interface OpenKlantLogicConfig {
  readonly openKlantApi: IOpenKlantAPI;
}

export enum SoortDigitaalAdres {
  EMAIL = 'email',
  TELEFOONNUMMER = 'telefoonnummer',
}

export class OpenKlantLogic {

  /**
   * Validates a phoone number using the open-klant regex for phonenumbers
   * @param phonenumber
   * @returns
   */
  static isValidPhonenumber(phonenumber: string) {
    const regex = /^(0[8-9]00[0-9]{4,7})|(0[1-9][0-9]{8})|(\+[0-9]{9,20}|1400|140[0-9]{2,3})$/;
    return regex.test(phonenumber);
  }

  private config: OpenKlantLogicConfig;

  constructor(config: OpenKlantLogicConfig) {
    this.config = config;
  }

  async updateContactgegevensNatuurlijkPersoon(user: User, email?: string, telefoonnummer?: string, voorkeur?: string) {

    // Get the partij if it exists
    let openKlantPartij = await this.config.openKlantApi.getPartijWithDigitaleAdresen(user);

    // Create the partij if it does not exist yet
    if (!openKlantPartij) {
      // TODO just throw an error if we do not have the name
      openKlantPartij = await this.config.openKlantApi.createNatuurlijkPersoon(user.userName ?? 'Onbekende gebruiker');
      await this.config.openKlantApi.addPartijIdentificatie(user, openKlantPartij.uuid);
    }

    // Update digitale adressen
    const openKlantEmail = await this.updateDigitaalAdres(openKlantPartij, SoortDigitaalAdres.EMAIL, email);
    const openKlantTelefoonnummer = await this.updateDigitaalAdres(openKlantPartij, SoortDigitaalAdres.TELEFOONNUMMER, telefoonnummer);

    // Save kanaal voorkeur
    if (voorkeur) {
      const adres = voorkeur == 'email' ? openKlantEmail : openKlantTelefoonnummer;
      if (!adres) {
        throw Error('This adres does not exist anymore!');
      }
      await this.updateVoorkeurDigitaalAdres(openKlantPartij, adres);
    }

  }

  /**
   * Update/creates digitaal adres if provided
   * When value undefined try to delete it (if exists)
   * @param user
   * @param partij
   * @param type
   * @param value
   */
  async updateDigitaalAdres(
    partij: OpenKlantPartijWithUuid,
    type: SoortDigitaalAdres,
    value: string | undefined,
  ): Promise<OpenKlantDigitaalAdresWithUuid | undefined> {

    const existing = partij._expand?.digitaleAdressen?.find(adres => adres.soortDigitaalAdres == type);

    // No value provided & digitaal adres exists -> delete
    if (!value && existing) {
      await this.config.openKlantApi.deleteDigitaalAdress(existing.uuid);
      return undefined;
    }

    // Value provided & digitaal adres exists -> update
    if (value && existing) {
      // Update digitaal adres
      return this.config.openKlantApi.updateDigitaalAdress(existing.uuid, value);
    }

    // Value provided & digitaal adres does not exist -> create
    if (value && !existing) {
      return this.config.openKlantApi.createDigitaalAdress(partij.uuid, type, value);
    }

    // No value provided & digitaal adres does not exist -> OK - do nothing
    return undefined;
  }

  async updateVoorkeurDigitaalAdres(partij: OpenKlantPartijWithUuid, voorkeursDigitaalAdres: OpenKlantDigitaalAdresWithUuid) {
    const input = {
      uuid: partij.uuid,
      voorkeursDigitaalAdres: { uuid: voorkeursDigitaalAdres.uuid },
    };
    return this.config.openKlantApi.updatePartij(input);
  }

}