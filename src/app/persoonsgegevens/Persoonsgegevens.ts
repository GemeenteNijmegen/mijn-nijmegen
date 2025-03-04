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
  readonly straat: string;
  readonly huisnummer: string;
  readonly postcode: string;
  readonly woonplaats: string;
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

    const geboorteDatumIso = data.geboorte.datum.datum as string;
    const geboortedatum = PersoonsgegevensMapper.isoDateToDutchFormat(geboorteDatumIso);

    return {
      bsn: data.burgerservicenummer,
      naam: data.adressering.aanschrijfwijze.naam,
      voorletters: data.naam.voorletters,
      voornamen: data.naam.voornamen,
      voorvoegsel: data.naam.voorvoegsel ?? '',
      geslachtsnaam: data.naam.geslachtsnaam,
      geboortedatum: geboortedatum,
      nederlandseNationaliteit: PersoonsgegevensMapper.hasNederlandseNationaliteit(data.nationaliteiten),
      geslacht: data.geslacht.code,

      straat: data.verblijfplaats.verblijfadres.officieleStraatnaam,
      huisnummer: data.verblijfplaats.verblijfadres.huisnummer,
      postcode: data.verblijfplaats.verblijfadres.postcode,
      woonplaats: data.verblijfplaats.verblijfadres.woonplaats,
    };
  }

  static hasNederlandseNationaliteit(nationaliteiten?: any[]) {
    if (!nationaliteiten || nationaliteiten.length == 0) {
      return 'Nee';
    }
    for (const nationaliteit of nationaliteiten) {
      if (nationaliteit.nationaliteit.code == LANDCODE_NEDERLAND) {
        return 'Ja';
      }
    }
    return 'Nee';
  }

  static isoDateToDutchFormat(geboorteDatumIso: string) {
    const year = geboorteDatumIso.substring(0, 4);
    const month = geboorteDatumIso.substring(5, 7);
    const day = geboorteDatumIso.substring(8, 10);
    return `${day}-${month}-${year}`;
  }

}

