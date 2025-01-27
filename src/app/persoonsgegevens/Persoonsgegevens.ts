export interface Persoonsgegevens {
  readonly bsn: string;
  readonly voorletters: string;
  readonly voornamen: string;
  readonly voorvoegsel: string;
  readonly geslachtsnaam: string;
  readonly achternaam: string;
  readonly geboortedatum: string;
  readonly nederlandseNationaliteit: string;
  readonly geslacht: string;
  readonly adres: string;
  //readonly postcode: string;
  // readonly woonplaats: string;
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
      adres: [
        persoon.Adres.Straat + ' ' + persoon.Adres.Huisnummer,
        persoon.Adres.Postcode + ' ' + persoon.Adres.Woonplaats,
      ].join('\n'),
      // postcode: persoon.Adres.Postcode,
      // woonplaats: persoon.Adres.Woonplaats,
    };
  }

  static fromHaalCentraal(data: any): Persoonsgegevens {
    return {
      bsn: data.burgerservicenummer,
      voorletters: data.naam.voorletters,
      voornamen: data.naam.voornamen,
      voorvoegsel: data.naam.voorvoegsel,
      geslachtsnaam: data.naam.geslachtsnaam,
      achternaam: data.naam.geslachtsnaam, // TODO this is the name hell we fixed in layer7
      geboortedatum: data.geboorte.datum.datum,
      nederlandseNationaliteit: data.nationaliteiten[0].code, // TODO this is a code...
      geslacht: data.geslacht.code, // TODO fix this code / mapping?
      adres: [
        data.adressering.adresregel1,
        data.adressering.adresregel2,
        data.adressering.adresregel3,
      ].join('\n'),
    };
  }
}
