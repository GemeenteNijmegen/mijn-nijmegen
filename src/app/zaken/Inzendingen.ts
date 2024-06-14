import axios, { Axios, AxiosInstance } from 'axios';
import { Inzending, InzendingSchema, InzendingenSchema } from './Inzending';
import { User } from './User';
import { SingleZaak, ZaakConnector, ZaakSummary } from './ZaakConnector';

export class Inzendingen implements ZaakConnector {
  private axios: Axios;
  private baseUrl: string;
  constructor(config: {
    baseUrl: URL | string;
    axiosInstance?: AxiosInstance | undefined;
    accessKey?: string | undefined;
  }) {
    this.baseUrl = config.baseUrl.toString();
    this.axios = this.initAxios({ baseUrl: this.baseUrl, accessKey: config.accessKey });
    this.setupDebugInterceptor();
  }

  private setupDebugInterceptor() {
    if (process.env.DEBUG) {
      this.axios.interceptors.request.use(function (configuration) {
        console.log(configuration);
        return configuration;
      }, function (error) {
        return Promise.reject(error);
      });
    }
  }

  private initAxios(config: {
    baseUrl: URL | string;
    axiosInstance?: AxiosInstance | undefined;
    accessKey?: string | undefined;
  }) {
    if (config.axiosInstance) {
      return config.axiosInstance;
    } else {
      if (!config.accessKey) {
        throw Error('access key must be provided for inzendingen.');
      }
      return axios.create(
        {
          baseURL: this.baseUrl,
          headers: {
            'x-api-key': config.accessKey,
          },
        },
      );
    }
  }

  async request(endpoint: string, authorization?: string, params?: URLSearchParams): Promise<any> {
    const paramString = params ? `?${params}` : '';
    const url =`${endpoint}${paramString}`;
    try {
      // console.debug('getting ', this.axios.getUri({ url }));
      const headers = authorization ? { Authorization: `Bearer ${authorization}` } : {};
      const response = await this.axios.get(url, {
        headers: headers,
      });
      if (response.status != 200) {
        // console.debug(response.request.responseURL);
        throw Error('Unexpected response: ' + response.status);
      }
      return response.data;
    } catch (error: any) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log(error.response.status);
        console.log(error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log('Error', error.message);
      }
      console.log(error.config);
      return error;
    }
  }

  async list(user: User): Promise<ZaakSummary[]> {
    const params = new URLSearchParams({
      user_id: user.identifier,
      user_type: user.type,
    });
    const results = await this.request('submissions', user.delegatedToken, params);
    const inzendingen = InzendingenSchema.parse(results);
    return inzendingen.map(inzending => this.summarize(inzending));
  }

  async get(key: string, user: User): Promise<false|SingleZaak> {
    const params = new URLSearchParams({
      user_id: user.identifier,
      user_type: user.type,
    });
    const results = await this.request(`submissions/${key}`, user.delegatedToken, params);
    const submission = this.summarizeSingle(InzendingSchema.parse(results));
    return submission;
  }

  async download(zaakId: string, file: string, user: User) {
    const submission = await this.get(zaakId, user);
    if (submission && submission.documenten?.find((document) => document.url == file)) {
      const params = new URLSearchParams({
        key: `${zaakId}/${file}`,
      });
      const results = await this.request('download', user.delegatedToken, params);
      return results;
    }
    return false;
  }

  summarize(inzending: Inzending): ZaakSummary {
    return {
      identifier: inzending.key,
      internal_id: `inzendingen/${inzending.key}`,
      registratiedatum: inzending?.dateSubmitted,
      zaak_type: inzending.formTitle,
      status: 'Ontvangen',
    };
  }

  summarizeSingle(inzending: Inzending) {
    const single: SingleZaak = {
      identifier: inzending.key,
      internal_id: `inzendingen/${inzending.key}`,
      zaak_type: inzending.formTitle,
      registratiedatum: inzending.dateSubmitted,
      status: 'Ontvangen',
      documenten: inzending.attachments.map((attachment) => {
        return {
          url: `attachments/${attachment}`,
          titel: attachment,
          registratieDatum: inzending.dateSubmitted,
          sort_order: 1,
        };
      }),
      type: 'submission',
    };
    // Add the PDF link to the documenten-list
    single.documenten!.push({
      url: `${inzending.key}.pdf`,
      titel: 'Formulier (PDF)',
      registratieDatum: inzending.dateSubmitted,
      sort_order: 0,
    });
    return single;
  }
}
