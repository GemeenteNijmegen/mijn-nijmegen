export interface ZaakSummary {
  identifier: string;
  internal_id: string;
  registratiedatum: Date;
  verwachtte_einddatum?: Date;
  uiterlijke_einddatum?: Date;
  einddatum?: Date | null | undefined;
  zaak_type: string;
  status: string | null;
  resultaat?: string | null;
}

export interface SingleZaak {
  identifier: string;
  internal_id: string;
  registratiedatum?: Date;
  verwachtte_einddatum?: Date;
  uiterlijke_einddatum?: Date;
  einddatum?: Date;
  zaak_type: string;
  status: string;
  status_list?: any[];
  resultaat?: string;
  documenten?: any[];
  taken?: any[];
  behandelaars?: string[];
  type: 'case' | 'submission';
}