import { User } from '../zaken/User';
import { OpenKlantPartijWithUuid } from './model/partij';
import { IOpenKlantAPI } from './OpenKlantApi';

interface OpenKlantLogicConfig {
  readonly openKlantApi: IOpenKlantAPI;
}

export enum SoortDigitaalAdres {
  EMAIL = 'email',
  TELEFOONNUMMER = 'telefoonnummer',
}

export class OpenKlantLogic {

  private config: OpenKlantLogicConfig;
  constructor(config: OpenKlantLogicConfig) {
    this.config = config;
  }

  async updateContactgegevensNatuurlijkPersoon(user: User, email?: string, telefoonnummer?: string) {

    // Get the partij if it exists
    let openKlantPartij = await this.config.openKlantApi.getPartijWithDigitaleAdresen(user);

    // Create the partij if it does not exist yet
    if (!openKlantPartij) {
      // TODO just throw an error if we do not have the name
      openKlantPartij = await this.config.openKlantApi.createNatuurlijkPersoon(user.userName ?? 'Onbekende gebruiker');
      await this.config.openKlantApi.addPartijIdentificatie(user, openKlantPartij.uuid);
    }

    // Update digitale adressen
    await this.updateDigitaalAdres(openKlantPartij, SoortDigitaalAdres.EMAIL, email);
    await this.updateDigitaalAdres(openKlantPartij, SoortDigitaalAdres.TELEFOONNUMMER, telefoonnummer);

  }

  /**
   * Update/creates digitaal adres if provided
   * When value undefined try to delete it (if exists)
   * @param user
   * @param partij
   * @param type
   * @param value
   */
  async updateDigitaalAdres(partij: OpenKlantPartijWithUuid, type: SoortDigitaalAdres, value: string | undefined) {
    const existing = partij._expand?.digitaleAdressen?.find(adres => adres.soortDigitaalAdres == type);

    // No value provided & digitaal adres exists -> delete
    if (!value && existing) {
      await this.config.openKlantApi.deleteDigitaalAdress(existing.uuid);
    }

    // Value provided & digitaal adres exists -> update
    if (value && existing) {
      // Update digitaal adres
      await this.config.openKlantApi.updateDigitaalAdress(existing.uuid, value);
    }

    // Value provided & digitaal adres does not exist -> create
    if (value && !existing) {
      await this.config.openKlantApi.createDigitaalAdress(partij.uuid, type, value);
    }

    // No value provided & digitaal adres does not exist -> OK - do nothing
  }

  static isValidPhonenumber(phonenumber: string) {
    const regex = /(0[8-9]00[0-9]{4,7})|(0[1-9][0-9]{8})|(\+[0-9]{9,20}|1400|140[0-9]{2,3})/
    return regex.test(phonenumber);
  }

}