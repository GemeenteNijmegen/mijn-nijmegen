import { LANDCODE_NEDERLANDSE } from '../../shared/HaalCentraalApi';

export interface Persoonsgegevens {
  readonly bsn: string;
  readonly naam?: string;
  readonly voorletters: string;
  readonly voornamen: string;
  readonly voorvoegsel: string;
  readonly geslachtsnaam: string;
  readonly achternaam?: string;
  readonly geboortedatum: string;
  readonly nederlandseNationaliteit: string;
  readonly geslacht: string;
  readonly adresregels: string[];
}

export class PersoonsgegevensMapper {

  static fromBrpApi(persoon: any): Persoonsgegevens {
    return {
      bsn: persoon.BSN.BSN,
      voorletters: persoon.Persoonsgegevens.Voorletters,
      voornamen: persoon.Persoonsgegevens.Voornamen,
      voorvoegsel: persoon.Persoonsgegevens.Voorvoegsel,
      geslachtsnaam: persoon.Persoonsgegevens.Geslachtsnaam,
      achternaam: persoon.Persoonsgegevens.Achternaam,
      geboortedatum: persoon.Persoonsgegevens.Geboortedatum,
      nederlandseNationaliteit: persoon.Persoonsgegevens.NederlandseNationaliteit,
      geslacht: persoon.Persoonsgegevens.Geslacht,

      adresregels: [
        `${persoon.Adres.Straat} ${persoon.Adres.Huisnummer}`,
        `${persoon.Adres.Postcode} ${persoon.Adres.Woonplaats}`,
      ],
    };
  }

  static fromHaalCentraal(data: any): Persoonsgegevens {
    return {
      bsn: data.burgerservicenummer,
      naam: data.adressering?.aanschrijfwijze?.naam ?? '',
      voorletters: data.naam?.voorletters ?? '',
      voornamen: data.naam?.voornamen ?? '',
      voorvoegsel: data.naam?.voorvoegsel ?? '',
      geslachtsnaam: data.naam?.geslachtsnaam ?? '',
      geboortedatum: data.geboorte?.datum?.langFormaat ?? '',
      nederlandseNationaliteit: data.nationaliteiten ? PersoonsgegevensMapper.hasNederlandseNationaliteit(data.nationaliteiten) : '',
      geslacht: data.geslacht?.code ?? '',

      adresregels: [
        data.adressering?.adresregel1,
        data.adressering?.adresregel2,
        data.adressering?.adresregel3,
      ].filter(regel => regel),
    };
  }

  static hasNederlandseNationaliteit(nationaliteiten?: any[]) {
    if (!nationaliteiten || nationaliteiten.length == 0) {
      return 'Nee';
    }
    let result = 'Nee';
    for (const nationaliteit of nationaliteiten) {
      if (nationaliteit.type == 'Nationaliteit'
        && nationaliteit.nationaliteit.code == LANDCODE_NEDERLANDSE) {
        return 'Ja';
      } else if (nationaliteit.type == 'BehandeldAlsNederlander') {
        result = 'Behandeld als Nederlander';
      } else if (nationaliteit.type == 'NationaliteitOnbekend') {
        result = 'Onbekend';
      }
    }
    return result;
  }

}

