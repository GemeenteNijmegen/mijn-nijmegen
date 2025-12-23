import { ApiClient } from '@gemeentenijmegen/apiclient';

import { Bsn } from '@gemeentenijmegen/utils';
import ObjectMapper from 'object-mapper';
import xml2js from 'xml2js';

export class UitkeringsApi {
  private client: ApiClient;
  private endpoint: string;
  constructor(client: ApiClient) {
    this.client = client ? client : new ApiClient();
    this.endpoint = process.env.UITKERING_API_URL ? process.env.UITKERING_API_URL : 'mijnNijmegenData';
  }

  async getUitkeringen(bsn: string) {
    try {
      const aBsn = new Bsn(bsn);
      const data = await this.client.postData(this.endpoint, this.body(aBsn.bsn), {
        'Content-type': 'text/xml',
        'SoapAction': 'https://data-test.nijmegen.nl/mijnNijmegenData/getData',
      });
      const object = await xml2js.parseStringPromise(data);
      const uitkeringsRows = this.mapUitkeringsRows(object);
      let uitkeringen = this.mapUitkering(uitkeringsRows);
      if (uitkeringen) {
        uitkeringen = this.addFieldsByName(uitkeringen);
        return uitkeringen;
      }
      return { uitkeringen: [] };
    } catch (error: any) {
      console.error(error);
      const data = {
        error: error.message,
      };
      return data;
    }
  }

  /**
     * Get request body
     *
     * NB: The xml:ns2 should be this exact string for all environments
     * including prod.
     *
     * @param {string} bsn bsn for person information should be returned for
     * @returns string an XML-payload for the request body
     */
  body(bsn: string) {
    return `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
                <ns2:dataRequest xmlns:ns2="https://data-test.nijmegen.nl/mijnNijmegenData/">
                    <identifier>${bsn}</identifier>
                    <contentSource>mijnUitkering</contentSource>
                </ns2:dataRequest>
            </soap:Body>
        </soap:Envelope>`;
  }

  mapUitkeringsRows(object: any) {
    const map = {
      'soap:Envelope.soap:Body[0].mij:dataResponse[0].groups[].group[0]': {
        key: 'uitkeringen',
        transform: ((value: any) => {
          if (!value) { return null; }
          const groups = value.filter((group: any) => {
            return group.groupName[0] == 'uitkeringen';
          });
          return groups[0].rows[0];
        }),
      },
    };
    return ObjectMapper(object, map);
  }

  mapUitkering(object: any) {
    const map = {
      'uitkeringen.row[].pageName[0]': 'uitkeringen[].type',
      'uitkeringen.row[].fields[0].field[].name[0]': 'uitkeringen[].fields[].label',
      'uitkeringen.row[].fields[0].field[].value[0]': 'uitkeringen[].fields[].value',
    };
    return ObjectMapper(object, map);
  }

  addFieldsByName(uitkeringen: any) {
    uitkeringen.uitkeringen.forEach((uitkering: any) => {
      const fieldsByName = uitkering.fields?.map((field: any) => {
        let obj: any = {};
        let label = field.label.toLowerCase().replace(/\s+/g, '-');
        obj[label] = field.value;
        return obj;
      });
      uitkering.fieldsByName = fieldsByName;
      uitkering.typetolower = uitkering.type.toLowerCase().replace(/\s+/g, '-');
    });
    return uitkeringen;
  }
}
