export const responses = {
  regulier: {
    type: 'RaadpleegMetBurgerservicenummer',
    personen: [
      {
        burgerservicenummer: '999999333',
        geslacht: {
          code: 'M',
          omschrijving: 'man',
        },
        naam: {
          aanduidingNaamgebruik: {
            code: 'E',
            omschrijving: 'eigen geslachtsnaam',
          },
          voornamen: 'Nasier',
          geslachtsnaam: 'Boeddhoe',
          voorletters: 'N.',
          volledigeNaam: 'Nasier Boeddhoe',
        },
        nationaliteiten: [
          {
            type: 'Nationaliteit',
            datumIngangGeldigheid: {
              type: 'Datum',
              datum: '1950-09-19',
              langFormaat: '19 september 1950',
            },
            nationaliteit: {
              code: '0312',
              omschrijving: 'Indiase',
            },
            redenOpname: {
              code: '301',
              omschrijving: 'Vaststelling bezit vreemde nationaliteit',
            },
          },
        ],
        geboorte: {
          land: {
            code: '7046',
            omschrijving: 'India',
          },
          plaats: {
            omschrijving: 'Amritsar',
          },
          datum: {
            type: 'Datum',
            datum: '1950-09-19',
            langFormaat: '19 september 1950',
          },
        },
        verblijfplaats: {
          type: 'Adres',
          verblijfadres: {
            officieleStraatnaam: 'Anna van Saksenlaan',
            korteStraatnaam: 'Anna van Saksenlaan',
            huisnummer: 71,
            postcode: '2593HW',
            woonplaats: "'s-Gravenhage",
          },
          functieAdres: {
            code: 'W',
            omschrijving: 'woonadres',
          },
          adresseerbaarObjectIdentificatie: '0518010000784987',
          nummeraanduidingIdentificatie: '0518200000784986',
          datumVan: {
            type: 'Datum',
            datum: '2000-02-28',
            langFormaat: '28 februari 2000',
          },
          datumIngangGeldigheid: {
            type: 'Datum',
            datum: '2011-11-01',
            langFormaat: '1 november 2011',
          },
        },
        adressering: {
          aanhef: 'Geachte heer Boeddhoe',
          aanschrijfwijze: {
            naam: 'N. Boeddhoe',
          },
          gebruikInLopendeTekst: 'de heer Boeddhoe',
          adresregel1: 'Anna van Saksenlaan 71',
          adresregel2: "2593 HW  'S-GRAVENHAGE",
        },
      },
    ],
  },
  buitenland: {
    type: 'RaadpleegMetBurgerservicenummer',
    personen: [
      {
        burgerservicenummer: '999998754',
        geslacht: {
          code: 'M',
          omschrijving: 'man',
        },
        naam: {
          aanduidingNaamgebruik: {
            code: 'E',
            omschrijving: 'eigen geslachtsnaam',
          },
          voornamen: 'Hendrik',
          voorvoegsel: 'van',
          geslachtsnaam: 'Hapert',
          voorletters: 'H.',
          volledigeNaam: 'Hendrik van Hapert',
        },
        nationaliteiten: [
          {
            type: 'Nationaliteit',
            datumIngangGeldigheid: {
              type: 'DatumOnbekend',
              onbekend: true,
              langFormaat: 'onbekend',
            },
            nationaliteit: {
              code: '0001',
              omschrijving: 'Nederlandse',
            },
          },
        ],
        geboorte: {
          land: {
            code: '6030',
            omschrijving: 'Nederland',
          },
          plaats: {
            code: '0518',
            omschrijving: "'s-Gravenhage",
          },
          datum: {
            type: 'Datum',
            datum: '1962-07-02',
            langFormaat: '2 juli 1962',
          },
        },
        opschortingBijhouding: {
          datum: {
            type: 'Datum',
            datum: '2018-12-01',
            langFormaat: '1 december 2018',
          },
          reden: {
            code: 'E',
            omschrijving: 'emigratie',
          },
        },
        adressering: {
          aanhef: 'Geachte heer Van Hapert',
          aanschrijfwijze: {
            naam: 'H. van Hapert',
          },
          gebruikInLopendeTekst: 'de heer Van Hapert',
          adresregel1: '51 Little Bourke Straat',
          adresregel2: '3000 Melbourne',
          land: {
            code: '6016',
            omschrijving: 'Australië',
          },
        },
      },
    ],
  },
  locatieomschrijving: {
    type: 'RaadpleegMetBurgerservicenummer',
    personen: [
      {
        burgerservicenummer: '999993550',
        geslacht: {
          code: 'V',
          omschrijving: 'vrouw',
        },
        naam: {
          aanduidingNaamgebruik: {
            code: 'E',
            omschrijving: 'eigen geslachtsnaam',
          },
          voornamen: 'Valerija',
          geslachtsnaam: 'Saladoecha',
          voorletters: 'V.',
          volledigeNaam: 'Valerija Saladoecha',
        },
        nationaliteiten: [
          {
            type: 'Nationaliteit',
            datumIngangGeldigheid: {
              type: 'DatumOnbekend',
              onbekend: true,
              langFormaat: 'onbekend',
            },
            nationaliteit: {
              code: '0034',
              omschrijving: 'Oekraïense',
            },
            redenOpname: {
              code: '301',
              omschrijving: 'Vaststelling bezit vreemde nationaliteit',
            },
          },
        ],
        geboorte: {
          land: {
            code: '6038',
            omschrijving: 'Oekraïne',
          },
          plaats: {
            omschrijving: 'Dnipropetrovsk',
          },
          datum: {
            type: 'Datum',
            datum: '2020-07-09',
            langFormaat: '9 juli 2020',
          },
        },
        verblijfplaats: {
          type: 'Locatie',
          datumVan: {
            type: 'Datum',
            datum: '2022-12-15',
            langFormaat: '15 december 2022',
          },
          functieAdres: {
            code: 'W',
            omschrijving: 'woonadres',
          },
          verblijfadres: {
            locatiebeschrijving: 'Droompark Havenzicht 12-34',
          },
          datumIngangGeldigheid: {
            type: 'Datum',
            datum: '2022-12-15',
            langFormaat: '15 december 2022',
          },
        },
        adressering: {
          aanhef: 'Geachte mevrouw Saladoecha',
          aanschrijfwijze: {
            naam: 'V. Saladoecha',
          },
          gebruikInLopendeTekst: 'mevrouw Saladoecha',
          adresregel1: 'Droompark Havenzicht 12-34',
          adresregel2: 'ROTTERDAM',
        },
      },
    ],
  },
  langestraatnaam: {
    type: 'RaadpleegMetBurgerservicenummer',
    personen: [
      {
        burgerservicenummer: '999991504',
        geslacht: {
          code: 'M',
          omschrijving: 'man',
        },
        naam: {
          voornamen: 'Thanatossy',
          geslachtsnaam: 'Olympossos',
          voorletters: 'T.',
          volledigeNaam: 'Thanatossy Olympossos',
        },
        nationaliteiten: [
          {
            type: 'Staatloos',
            datumIngangGeldigheid: {
              type: 'DatumOnbekend',
              onbekend: true,
              langFormaat: 'onbekend',
            },
            redenOpname: {
              code: '312',
              omschrijving: 'Vaststelling staatloosheid',
            },
          },
        ],
        geboorte: {
          land: {
            code: '6030',
            omschrijving: 'Nederland',
          },
          plaats: {
            code: '0109',
            omschrijving: 'Coevorden',
          },
          datum: {
            type: 'Datum',
            datum: '1988-04-01',
            langFormaat: '1 april 1988',
          },
        },
        opschortingBijhouding: {
          datum: {
            type: 'Datum',
            datum: '2012-12-20',
            langFormaat: '20 december 2012',
          },
          reden: {
            code: 'R',
            omschrijving: 'pl is aangelegd in de rni',
          },
        },
        adressering: {
          aanhef: 'Geachte heer Olympossos',
          aanschrijfwijze: {
            naam: 'T. Olympossos',
          },
          gebruikInLopendeTekst: 'de heer Olympossos',
          adresregel1: 'Av. Vasco de Quiroga 3000/7',
          adresregel2: '01210 Mexico-Stad',
          adresregel3: 'Edificio Calakmul, Colonia',
          land: {
            code: '5095',
            omschrijving: 'Aruba',
          },
        },
        rni: [
          {
            deelnemer: {
              code: '0401',
            },
            categorie: 'Persoon',
          },
          {
            deelnemer: {
              code: '0401',
            },
            categorie: 'Verblijfplaats',
          },
          {
            deelnemer: {
              code: '0401',
            },
            categorie: 'Nationaliteit',
          },
        ],
        verificatie: {
          datum: {
            type: 'Datum',
            datum: '2012-12-20',
            langFormaat: '20 december 2012',
          },
          omschrijving: 'Correctie adres',
        },
      },
    ],
  },
  behandeldAlsNederlander: {
    type: 'RaadpleegMetBurgerservicenummer',
    personen: [
      {
        burgerservicenummer: '999994098',
        geslacht: {
          code: 'V',
          omschrijving: 'vrouw',
        },
        naam: {
          aanduidingNaamgebruik: {
            code: 'E',
            omschrijving: 'eigen geslachtsnaam',
          },
          geslachtsnaam: 'Julia Christine Maria Melap',
          volledigeNaam: 'Julia Christine Maria Melap',
        },
        nationaliteiten: [
          {
            type: 'BehandeldAlsNederlander',
            datumIngangGeldigheid: {
              type: 'Datum',
              datum: '1957-01-15',
              langFormaat: '15 januari 1957',
            },
            redenOpname: {
              code: '310',
              omschrijving: 'Vaststelling bijzonder Nederlanderschap',
            },
          },
        ],
        geboorte: {
          land: {
            code: '9030',
            omschrijving: 'Nederlands-Indië',
          },
          plaats: {
            omschrijving: 'Banda-Neira',
          },
          datum: {
            type: 'Datum',
            datum: '1946-09-12',
            langFormaat: '12 september 1946',
          },
        },
        verblijfplaats: {
          type: 'Adres',
          verblijfadres: {
            officieleStraatnaam: 'Westduinweg',
            korteStraatnaam: 'Westduinweg',
            huisnummer: 12,
            postcode: '2583AE',
            woonplaats: "'s-Gravenhage",
          },
          functieAdres: {
            code: 'W',
            omschrijving: 'woonadres',
          },
          adresseerbaarObjectIdentificatie: '0518200000374658',
          nummeraanduidingIdentificatie: '0518010000374659',
          datumVan: {
            type: 'Datum',
            datum: '2016-01-02',
            langFormaat: '2 januari 2016',
          },
          datumIngangGeldigheid: {
            type: 'Datum',
            datum: '2016-01-02',
            langFormaat: '2 januari 2016',
          },
        },
        adressering: {
          aanhef: 'Geachte mevrouw Julia Christine Maria Melap',
          aanschrijfwijze: {
            naam: 'Julia Christine Maria Melap',
          },
          gebruikInLopendeTekst: 'mevrouw Julia Christine Maria Melap',
          adresregel1: 'Westduinweg 12',
          adresregel2: "2583 AE  'S-GRAVENHAGE",
        },
      },
    ],
  },
};
