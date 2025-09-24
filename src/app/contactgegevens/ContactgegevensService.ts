import { Logger } from '@aws-lambda-powertools/logger';
import z from 'zod';
import { User } from '../zaken/User';
import { OpenKlantDigitaalAdresWithUuid, OpenKlantPartijWithUuid } from './model/partij';
import { IOpenKlantAPI, SoortDigitaalAdres } from './OpenKlantApi';


export const VoorkeurSchema = z.enum(['telefoon', 'email']);

export type Voorkeur = z.infer<typeof VoorkeurSchema>;

export const ContactgegevensSchema = z.object({
  email: z.string().optional(),
  telefoonnummer: z.string().optional(),
  voorkeur: z.enum(['telefoon', 'email']).optional(),
});

export type Contactgegevens = z.infer<typeof ContactgegevensSchema>;

export class ContactgegevensService {

  private openklant: IOpenKlantAPI;
  private logger: Logger;

  constructor(openklant: IOpenKlantAPI, logger?: Logger) {
    this.openklant = openklant;
    this.logger = logger ?? new Logger();
  }

  async getContactgegevens(user: User): Promise<Contactgegevens> {

    if (user.type == 'organisation') {
      // TODO support organizations
      throw new Error('Not implemented for organizations yet');
    }

    const partij = await this.openklant.getPartijWithDigitaleAdresen(user);

    if (!partij) {
      this.logger.debug('Did not find partij for user', { user });
      return {};
    }

    this.logger.debug('Found a partij for user', { user, partij });
    return this.getContactgegevensFromPartij(partij);

  }

  async updateContactgegevensNatuurlijkPersoon(user: User, contactgegevens: Contactgegevens) {

    // Get the partij if it exists
    let openKlantPartij = await this.openklant.getPartijWithDigitaleAdresen(user);

    // Create the partij if it does not exist yet
    if (!openKlantPartij) {
      // TODO just throw an error if we do not have the name
      openKlantPartij = await this.openklant.createNatuurlijkPersoon(user.userName ?? 'Onbekende gebruiker');
      await this.openklant.addPartijIdentificatie(user, openKlantPartij.uuid);
    }

    // Update digitale adressen
    const openKlantEmail = await this.updateDigitaalAdres(openKlantPartij, SoortDigitaalAdres.EMAIL, contactgegevens.email);
    const openKlantTelefoonnummer = await this.updateDigitaalAdres(
      openKlantPartij,
      SoortDigitaalAdres.TELEFOONNUMMER,
      contactgegevens.telefoonnummer,
    );

    // Save kanaal voorkeur
    if (contactgegevens.voorkeur) {
      const adres = contactgegevens.voorkeur == 'email' ? openKlantEmail : openKlantTelefoonnummer;
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
      await this.openklant.deleteDigitaalAdress(existing.uuid);
      return undefined;
    }

    // Value provided & digitaal adres exists -> update
    if (value && existing) {
      // Update digitaal adres
      return this.openklant.updateDigitaalAdress(existing.uuid, value);
    }

    // Value provided & digitaal adres does not exist -> create
    if (value && !existing) {
      return this.openklant.createDigitaalAdress(partij.uuid, type, value);
    }

    // No value provided & digitaal adres does not exist -> OK - do nothing
    return undefined;
  }

  async updateVoorkeurDigitaalAdres(partij: OpenKlantPartijWithUuid, voorkeursDigitaalAdres: OpenKlantDigitaalAdresWithUuid) {
    const input = {
      uuid: partij.uuid,
      voorkeursDigitaalAdres: { uuid: voorkeursDigitaalAdres.uuid },
      soortPartij: partij.soortPartij,
    };
    return this.openklant.updatePartij(input);
  }


  /**
   * Map partij info (including _expand with digitale addressen) to Contactgegevens interface
   * @param partij
   * @returns
   */
  private getContactgegevensFromPartij(partij: OpenKlantPartijWithUuid): Contactgegevens {

    const email = partij._expand?.digitaleAdressen?.find((adres: any) => adres.soortDigitaalAdres == 'email');
    const telefoonnummer = partij._expand?.digitaleAdressen?.find((adres: any) => adres.soortDigitaalAdres == 'telefoonnummer');

    let voorkeurString: Voorkeur | undefined = undefined;
    const voorkeur = partij.voorkeursDigitaalAdres?.uuid;
    if (voorkeur) {
      const emailIsVoorkeur = voorkeur == email?.uuid;
      const telefoonIsVoorkeur = voorkeur == telefoonnummer?.uuid;
      if (emailIsVoorkeur) {
        voorkeurString = 'email';
      } else if (telefoonIsVoorkeur) {
        voorkeurString = 'telefoon';
      }
    }

    const data: Partial<Contactgegevens> = {
      email: email ? email.adres : undefined,
      telefoonnummer: telefoonnummer ? telefoonnummer.adres : undefined,
      voorkeur: voorkeurString,
    };
    return data;
  }

}