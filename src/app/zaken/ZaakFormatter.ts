import { SingleZaak, ZaakSummary } from './ZaakConnector';

export class ZaakFormatter {
  formatList(zaken: ZaakSummary[]) {
    const sorted = zaken
      .sort((a, b) => a.registratiedatum < b.registratiedatum ? 1 : -1)
      .map(zaak => this.formatZaakSummary(zaak));
    return {
      open: sorted.filter(zaak => !zaak.resultaat),
      gesloten: sorted.filter(zaak => zaak.resultaat),
    };
  }

  formatZaakSummary(zaak: ZaakSummary) {
    try {
      const result = {
        ...zaak,
        registratiedatum: this.humanDate(zaak.registratiedatum),
        verwachtte_einddatum: this.humanDate(zaak.verwachtte_einddatum),
        uiterlijke_einddatum: this.humanDate(zaak.uiterlijke_einddatum),
        einddatum: this.humanDate(zaak.einddatum),
      };
      return result;
    } catch (error) {
      console.error(error, zaak, 'hopelijk iets met datums');
      throw (error);
    }
  }

  formatZaak(zaak: SingleZaak) {
    return {
      ...zaak,
      registratiedatum: this.humanDate(zaak.registratiedatum),
      verwachtte_einddatum: this.humanDate(zaak.verwachtte_einddatum),
      uiterlijke_einddatum: this.humanDate(zaak.uiterlijke_einddatum),
      einddatum: this.humanDate(zaak.einddatum),
      has_documenten: zaak.documenten && zaak.documenten?.length > 0 ? true : false,
      documenten: zaak.documenten?.sort(this.sortDocuments),
      has_taken: zaak.taken && zaak.taken?.length > 0 ? true : false,
      has_statuses: zaak.status_list && zaak.status_list?.length > 0 ? true : false,
      behandelaars: zaak.behandelaars?.sort((a, b) => a < b ? -1 : 1).join(', '),
      has_behandelaars: zaak.behandelaars && zaak.behandelaars.length > 0 ? true : false,
      is_submission: zaak.type == 'submission',
      is_case: zaak.type == 'case',
    };
  }

  /**
   * Convert ISO 8601 datestring to something formatted like '12 september 2023'
   */
  private humanDate(date: Date | undefined) {
    if (!date) { return; }
    return date.toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  private sortDocuments(document_a: any, document_b: any) {
    if (document_a.sort_order || document_b.sort_order) {
      return document_a.sort_order > document_b.sort_order ? 1 : -1;
    }
    if (document_a.registratieDatum !== document_b.registratieDatum) {
      return document_a.registratieDatum < document_b.registratieDatum ? 1 : -1;
    }
    return document_a.titel < document_b.titel ? 1 : -1;
  }
}
