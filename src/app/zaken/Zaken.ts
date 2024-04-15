import { OpenZaakClient } from './OpenZaakClient';
import { Taken } from './Taken';
import { User } from './User';
import { SingleZaak, ZaakConnector, ZaakSummary } from './ZaakConnector';

interface Config {
  zaakConnectorId: string;
  taken?: Taken;

  /**
   * Feature flag: Unless this is true, we will not
   * call the documents endpoint (and thus won't show documents).
   */
  show_documents?: boolean;
}

export class Zaken implements ZaakConnector {
  private client: OpenZaakClient;
  private statusTypesPromise: Promise<any>;
  private zaakTypesPromise: Promise<any>;
  private resultaatTypesPromise: Promise<any>;
  private catalogiPromise: Promise<any>;

  private statusTypes?: any;
  private zaakTypes?: any;
  private resultaatTypes?: any;
  private catalogi?: any;

  private allowedDomains?: string[];

  private taken?: Taken;

  private show_documents?: boolean;

  public zaakConnectorId: string;

  constructor(client: OpenZaakClient, config: Config) {
    this.client = client;
    this.taken = config?.taken;
    this.show_documents = config?.show_documents;
    this.zaakConnectorId = config.zaakConnectorId;

    // Cache metadata
    this.catalogiPromise = this.client.request('/catalogi/api/v1/catalogussen');
    this.zaakTypesPromise = this.client.request('/catalogi/api/v1/zaaktypen');
    this.statusTypesPromise = this.client.request('/catalogi/api/v1/statustypen');
    this.resultaatTypesPromise = this.client.request('/catalogi/api/v1/resultaattypen');
  }
  download(_zaakId: string, _file: string, _user: User): Promise<{ downloadUrl: string }> {
    throw new Error('Method not implemented.');
  }

  setTaken(taken: Taken|false) {
    if (taken) {
      this.taken = taken;
    }
  }

  /**
   * If this method is called, all further requests are matched
   * for this list of domains. The domains can be found in the zaaktypecatalogus
   * object, and will be matched via zaak.zaaktype => zaaktype.catalogus, => catalogus.domein
   *
   * @param domains a list of domain strings to allow
   */
  public allowDomains(domains: string[]) {
    this.allowedDomains = domains;
  }

  /**
   * List all zaken for a person
   *
   * @returns
   */
  async list(user: User) {
    await this.metaData();

    console.time('list zaken');
    let zaken;
    if (user.type == 'person') {
      const params = new URLSearchParams({
        rol__betrokkeneIdentificatie__natuurlijkPersoon__inpBsn: user.identifier,
        ordering: '-startdatum',
        page: '1',
      });

      // Get all zaken
      zaken = await this.client.request('/zaken/api/v1/zaken', params);

    } else if (user.type == 'organisation') {
      const params = new URLSearchParams({
        betrokkeneIdentificatie__nietNatuurlijkPersoon__annIdentificatie: user.identifier,
      });
      const roles = await this.client.request('/zaken/api/v1/rollen', params);
      const zaakUrls = roles?.results?.map((role: any) => role.zaak);
      if (zaakUrls) {
        const zakenResults = await Promise.all(zaakUrls.map((zaakUrl: string) => this.client.request(zaakUrl)));
        zaken = { results: zakenResults };
      }
    }

    console.timeLog('list zaken', 'received zaken');
    if (zaken?.results) {
      const [statussen, resultaten] = await this.zaakMetaData(zaken);
      console.timeLog('list zaken', 'received zaakmetadata');
      console.timeEnd('list zaken');
      return this.summarizeZaken(zaken, statussen, resultaten);
    }
    console.timeEnd('list zaken');
    return [];
  }

  async get(zaakId: string, user: User): Promise<SingleZaak|false> {
    await this.metaData();

    console.time('get zaak');
    let roleUrl;
    const zaakUrl = `${this.client.baseUrl}zaken/api/v1/zaken/${zaakId}`;
    if (user.type == 'person') {
      roleUrl = `/zaken/api/v1/rollen?betrokkeneIdentificatie__natuurlijkPersoon__inpBsn=${user.identifier}&zaak=${zaakUrl}`;
    } else {
      roleUrl = `/zaken/api/v1/rollen?betrokkeneIdentificatie__nietNatuurlijkPersoon__annIdentificatie=${user.identifier}&zaak=${zaakUrl}`;
    }
    const [zaak, rol] = await Promise.all([
      this.client.request(`/zaken/api/v1/zaken/${zaakId}`),
      this.client.request(roleUrl),
    ]);
    // Only process zaken in allowed catalogi
    if (!this.zaakTypeInAllowedCatalogus(zaak.zaaktype)) { return false; }

    const statusPromise = zaak.status ? this.client.request(zaak.status) : null;
    const resultaatPromise = zaak.resultaat ? this.client.request(zaak.resultaat) : null;
    const documentPromise = this.documents(zaakId);
    const taken = await this.getTaken(zaakId);
    const [status, resultaat, documents] = await Promise.all([statusPromise, resultaatPromise, documentPromise]);
    const zaakType = this.zaakTypes?.results?.find((type: any) => type.url == zaak.zaaktype);
    const behandelaars = await this.getBehandelaars(zaakUrl);

    console.timeLog('get zaak', 'zaak opgehaald');
    console.timeEnd('get zaak');
    if (Number(rol?.count) >= 1) { //TODO: Omschrijven (ik gok check of persoon met bsn wel rol heeft in de zaak)
      return {
        internal_id: `${this.zaakConnectorId}/${zaak.uuid}`,
        identifier: zaak.identificatie,
        registratiedatum: new Date(zaak.registratiedatum),
        verwachtte_einddatum: new Date(zaak.einddatumGepland),
        uiterlijke_einddatum: new Date(zaak.uiterlijkeEinddatumAfdoening),
        einddatum: zaak.einddatum ? new Date(zaak.einddatum) : undefined,
        zaak_type: zaakType?.omschrijving,
        status_list: this.statusTypesForZaakType(zaakType, status),
        status: this.statusTypes.results.find((type: any) => type.url == status?.statustype)?.omschrijving || null,
        resultaat: resultaat?.omschrijving ?? null,
        documenten: documents,
        taken: taken,
        behandelaars,
        type: 'case',
      };
    }
    return false;
  }

  private async getBehandelaars(zaakUrl: string) {
    const behandelaars = await this.client.request(`/zaken/api/v1/rollen?zaak=${zaakUrl}&omschrijvingGeneriek=behandelaar`);
    return behandelaars?.results?.filter((behandelaar: any) => behandelaar?.omschrijvingGeneriek == 'behandelaar').map((behandelaar: any) => behandelaar.betrokkeneIdentificatie.achternaam);
  }

  private statusTypesForZaakType(zaakType: any, status: any) {
    if (!status) {
      return null;
    }
    const statusTypenUrls = zaakType.statustypen;
    const statusTypen = this.statusTypes?.results.filter((statusType: any) => statusTypenUrls.indexOf(statusType.url) > -1);
    statusTypen.sort((a: any, b: any) => { return a.volgnummer > b.volgnummer ? 1 : -1; });
    let before_current = true;
    const status_list = statusTypen.map((statusType: any) => {
      const current = status.statustype == statusType.url;
      if (current) { before_current = false; }
      return {
        name: statusType.omschrijving,
        is_eind: statusType.isEindstatus,
        completed: before_current,
        volgnummer: statusType.volgnummer,
        current,
      };
    });
    return status_list;
  }

  /**
   * Gather metadata for zaken
   *
   * @param zaken all zaken we're interested in
   * @returns `[statussen, resultaten]` An array with two elements, containing the status- and resultaat-objects
   */
  private async zaakMetaData(zaken: any) {
    if (!zaken.results) {
      throw Error('No zaken found');
    };
    // Gather status-urls from zaken, so we can get all statusses in parallel
    const status_urls = zaken.results.map((zaak: any) => zaak.status).filter((status: any) => status != null);
    // Gather resultaat-urls from zaken, so we can get all resultaten in parallel
    const resultaat_urls = zaken.results.map((zaak: any) => zaak.resultaat).filter((resultaat: any) => resultaat != null);

    // Get all statuses and resultaten in parallel
    return Promise.all([
      Promise.all(status_urls.map((status: string) => this.client.request(status))),
      Promise.all(resultaat_urls.map((resultaat: string) => this.client.request(resultaat))),
    ]);
  }

  private summarizeZaken(zaken: any, statussen: any[], resultaten: any[]): ZaakSummary[] {
    const zaak_summaries = [];
    for (const zaak of zaken.results) {
      // Only process zaken in allowed catalogi
      if (!this.zaakTypeInAllowedCatalogus(zaak.zaaktype)) { continue; }
      const status = statussen.find((aStatus: any) => aStatus.url == zaak.status);
      const resultaat = resultaten.find((aResultaat: any) => aResultaat.url == zaak.resultaat);
      const zaaktype = this.zaakTypes.results.find((type: any) => type.url == zaak.zaaktype)?.omschrijving;
      let status_type = null;
      if (status) {
        status_type = this.statusTypes.results.find((type: any) => type.url == status.statustype)?.omschrijving;
      }
      let resultaat_type = null;
      if (resultaat) {
        resultaat_type = this.resultaatTypes.results.find((type: any) => type.url == resultaat.resultaattype)?.omschrijving;
      }
      const summary = {
        identifier: zaak.identificatie,
        internal_id: `${this.zaakConnectorId}/${zaak.uuid}`,
        registratiedatum: new Date(zaak.registratiedatum),
        verwachtte_einddatum: new Date(zaak.einddatumGepland),
        uiterlijke_einddatum: new Date(zaak.uiterlijkeEinddatumAfdoening),
        einddatum: zaak.einddatum ? new Date(zaak.einddatum) : undefined,
        zaak_type: zaaktype,
        status: status_type,
        resultaat: resultaat_type,
      };
      zaak_summaries.push(summary);
    }
    return zaak_summaries;
  }

  /** Guarantee metadata promises are resolved */
  async metaData() {
    console.time('metadata');
    console.timeLog('metadata', 'awaiting metadata');
    if (!this.zaakTypes || !this.statusTypes || !this.resultaatTypes || !this.catalogi) {
      [
        this.zaakTypes,
        this.statusTypes,
        this.resultaatTypes,
        this.catalogi,
      ] = await Promise.all([
        this.zaakTypesPromise,
        this.statusTypesPromise,
        this.resultaatTypesPromise,
        this.catalogiPromise,
      ]);
    }
    console.timeLog('metadata', 'retreived metadata');
    console.timeEnd('metadata');
  }

  /**
   * We need to filter for zaken from specific systems. The catalogi hold
   * the domains (APV & JZ), this filters the catalogi based on the allowed
   * domains (`this.allowedDomains`)
   */
  private allowedCatalogi() {
    if (this.allowedDomains && this.catalogi?.results) {
      return this.catalogi?.results?.filter((catalogus: any) => this.allowedDomains!.includes(catalogus.domein));
    }
    return this.catalogi.results;
  }

  private zaakTypeInAllowedCatalogus(zaakType: any) {
    const catalogi = this.allowedCatalogi();
    if (catalogi) {
      for (let catalogus of this.allowedCatalogi()) {
        if (catalogus?.zaaktypen.includes(zaakType)) { return true; }
      }
      return false;
    }
    return true;
  }

  private async documents(zaakId: string) {
    if (!this.show_documents) { return []; }
    try {
      const zaakinformatieobjecten = await this.client.request(`/zaken/api/v1/zaakinformatieobjecten?zaak=${this.client.baseUrl}zaken/api/v1/zaken/${zaakId}`);

      if (!zaakinformatieobjecten || zaakinformatieobjecten.length <= 0) { return []; }
      const documentUrls = zaakinformatieobjecten
        .map((zaakinformatieobject: any) => zaakinformatieobject.informatieobject).filter((informatieobject: any) => informatieobject != null,
        );
      const enkelvoudiginformatieobjecten = await Promise.all(documentUrls.map((url: string) => this.client.request(url)));
      return enkelvoudiginformatieobjecten.map((object) => {
        return {
          url: object.url,
          titel: object.titel,
          beschrijving: object.beschrijving,
          registratieDatum: object.beginRegistratie,
        };
      });
    } catch (error: any) {
      console.error(error);
      return [];
    }
  }

  async getTaken(zaakId: string) {
    if (!this.taken) { return null; }
    return this.taken.get(zaakId);
  }
}
