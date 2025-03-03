import { LANDCODE_NEDERLAND } from '../../shared/HaalCentraalApi';

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

  readonly adresHaalCentraal?: string;
  readonly straat?: string;
  readonly huisnummer?: string;
  readonly postcode?: string;
  readonly woonplaats?: string;
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

      straat: persoon.Adres.Straat,
      huisnummer: persoon.Adres.Huisnummer,
      postcode: persoon.Adres.Postcode,
      woonplaats: persoon.Adres.Woonplaats,
    };
  }

  static fromHaalCentraal(data: any): Persoonsgegevens {

    return {
      bsn: data.burgerservicenummer,
      naam: data.adressering.aanschrijfwijze.naam,
      voorletters: data.naam.voorletters,
      voornamen: data.naam.voornamen,
      voorvoegsel: data.naam.voorvoegsel ?? '-', // TODO not always present
      geslachtsnaam: data.naam.geslachtsnaam,
      geboortedatum: data.geboorte.datum.datum,
      nederlandseNationaliteit: data.nationaliteiten[0].code == LANDCODE_NEDERLAND ? 'Ja' : 'Nee', // TODO loop
      geslacht: data.geslacht.code,
      adresHaalCentraal: [
        data.adressering.adresregel1 ?? '',
        data.adressering.adresregel2 ?? '',
        data.adressering.adresregel3 ?? '',
      ].join('\n'),
    };
  }

}
