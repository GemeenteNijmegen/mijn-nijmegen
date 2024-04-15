import axios, { Axios, AxiosInstance } from 'axios';
import jwt from 'jsonwebtoken';

export class OpenZaakClient {
  private axios: Axios;
  public baseUrl: string;

  constructor(config: {
    baseUrl: URL | string;
    axiosInstance?: AxiosInstance;
    clientId?: string;
    userId?: string;
    secret?: string;
  }) {
    this.baseUrl = config.baseUrl.toString();
    this.axios = this.initAxios(config);
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
    axiosInstance?: AxiosInstance | undefined;
    clientId?: string | undefined;
    userId?: string | undefined;
    secret?: string | undefined;
  }) {
    if (config.axiosInstance) {
      return config.axiosInstance;
    } else {
      if (!config.clientId || !config.userId || !config.secret) {
        throw Error('client Id, userId and secret must be provided in config if no axios Instance is provided');
      }
      return axios.create(
        {
          baseURL: this.baseUrl,
          headers: {
            'Authorization': 'Bearer ' + this.jwtToken(config.clientId, config.userId, config.secret),
            'Accept-Crs': 'EPSG:4326',
            'Content-Crs': 'EPSG:4326',
          },
        },
      );
    }
  }

  private jwtToken(clientId: string, userId: string, secret: string) {
    const token = jwt.sign({
      iss: clientId,
      iat: Date.now(),
      client_id: clientId,
      user_id: userId,
      user_representation: userId,
    }, secret);
    return token;
  }

  async requestSingle(endpoint: string, params?: URLSearchParams): Promise<any> {
    const paramString = params ? `?${params}` : '';
    const url =`${endpoint}${paramString}`;
    try {
      const response = await this.axios.get(url);
      if (response.status != 200) {
        console.debug(response.request.responseURL);
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

  async request(endpoint: string, params?: URLSearchParams): Promise<any> {
    const data = await this.requestSingle(endpoint, params);
    if (data.next) {
      // request next page
      const page = await this.request(data.next);
      if (page.results) {
        data.results = [...data.results, ...page.results];
      }
    }
    // return merged data
    return data;
  }
}
