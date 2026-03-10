import https from 'https';
import { AWS } from '@gemeentenijmegen/utils';
import axios, { AxiosInstance } from 'axios';

export interface ApiClientOptions {
  /**
   * Request timeout in ms
   * @default 2000
   */
  timeout?: number;
  /**
   * Bring your own axios instance
   * Used for testing
   */
  axiosInstance?: AxiosInstance;
  /**
   * Add a mTLS configuration for this API Client.
   * Note use SSM parameters to load values from
   * the parameter store.
   */
  mtls?: {
    /**
     * Privat key ARN for loading the private key
     */
    keyArn: string;
    /**
     * SSM Parameter name for loading the certificate
     */
    cert: string;
    /**
     * SSM Parameter name for loading the ca bundle
     * @default - No ca bundle is used
     */
    ca?: string;
  };
  /**
   * Provide a header name and value for adding an API key
   * to the request.
   * NOTE: not implemented yet
   */
  apikey?: {
    header: string;
    keyArn: string;
    prefix?: string;
  };
}


export class ApiClient {

  private apikey: string | undefined;
  private privatekey: string | undefined;
  private cert: string | undefined;
  private ca: string | undefined;
  private axios: AxiosInstance;
  private options: ApiClientOptions | undefined;

  /**
   * Connects to API's. Use .post() or .get() to get the actual info
   *
   * @param {ApiClientOptions} options options to configure this API client
  */
  constructor(options: ApiClientOptions) {
    this.axios = this.initAxios(options?.axiosInstance);
    this.options = options;
  }

  private initAxios(axiosInstance?: AxiosInstance): AxiosInstance {
    if (axiosInstance) {
      return axiosInstance;
    }
    return axios.create();
  }

  /**
   * Do a HTTP POST request to an endpoint.
   * @param endpoint The url to request
   * @param body The body to send to the endpoint
   * @param headers Headers to include
   */
  async postData(endpoint: string, body: any, headers?: any): Promise<any> {
    const config = await this.getRequestConfiguration();
    console.time('request to ' + endpoint);
    try {
      const response = await this.axios.post(endpoint, body, {
        httpsAgent: config.httpsAgent,
        headers: {
          ...config.headers,
          ...headers,
        },
        timeout: this.options?.timeout,
      });
      console.timeEnd('request to ' + endpoint);
      return response.data;
    } catch (error) {
      console.timeEnd('request to ' + endpoint);
      this.handleErrors(error, endpoint);
    }
  }

  /**
   * Do a HTTP PUT request to an endpoint.
   * @param endpoint The url to request
   * @param body The body to send to the endpoint
   * @param headers Headers to include
   */
  async putData(endpoint: string, body: any, headers?: any): Promise<any> {
    const config = await this.getRequestConfiguration();
    console.time('request to ' + endpoint);
    try {
      const response = await this.axios.put(endpoint, body, {
        httpsAgent: config.httpsAgent,
        headers: {
          ...config.headers,
          ...headers,
        },
        timeout: this.options?.timeout,
      });
      console.timeEnd('request to ' + endpoint);
      return response.data;
    } catch (error) {
      console.timeEnd('request to ' + endpoint);
      this.handleErrors(error, endpoint);
    }
  }

  /**
   * Do a HTTP GET request to an endpoint.
   * @param endpoint The url to request
   * @param headers Headers to include
   */
  async getData(endpoint: string, headers?: any): Promise<any> {
    const config = await this.getRequestConfiguration();
    console.time('GET request to ' + endpoint);
    try {
      const response = await this.axios.get(endpoint, {
        httpsAgent: config.httpsAgent,
        headers: {
          ...config.headers,
          ...headers,
        },
        timeout: this.options?.timeout,
      });
      console.timeEnd('GET request to ' + endpoint);
      return response.data;
    } catch (error) {
      console.timeEnd('GET request to ' + endpoint);
      this.handleErrors(error, endpoint);
    }
  }

  private handleErrors(error: any, endpoint: string) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log('http status for ' + endpoint + ': ' + error.response.status);
      } else if (error?.code === 'ECONNABORTED') {
        // Check for a timeout
        throw new Error('Het ophalen van gegevens duurt te lang.');
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.error(error?.code);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error(error.message);
      }
    } else {
      console.error(error.message);
    }

    throw new Error('Het ophalen van gegevens is misgegaan.');
  }

  private async getRequestConfiguration() {

    // API key header
    const headers: Record<string, string> = {};
    if (this.options?.apikey) {
      const prefix = this.options.apikey.prefix;
      const apikey = await this.getApiKey();
      headers[this.options.apikey.header] = prefix ? `${prefix} ${apikey}` : apikey;
    }

    // Mtls configuration
    let agentConfig = {};
    if (this.options?.mtls) {
      await this.getMtlsConfiguration();
      agentConfig = {
        cert: this.cert,
        key: this.privatekey,
        ca: this.ca,
      };
    }
    const httpsAgent = new https.Agent(agentConfig);

    return {
      httpsAgent: httpsAgent,
      headers: headers,
    };
  }

  private async getApiKey() {
    if (!this.apikey) {
      if (!this.options?.apikey?.keyArn) {
        throw Error('No API key arn configuration while getting API key.');
      }
      this.apikey = await AWS.getSecret(this.options.apikey.keyArn);
    }
    return this.apikey;
  }

  private async getMtlsConfiguration() {
    if (!this.options?.mtls) {
      throw Error('No mTLS configuration found while getting trying to setup mTLS.');
    }

    // Load the private key and certificate
    if (!this.privatekey || !this.cert) {
      this.privatekey = await AWS.getSecret(this.options.mtls.keyArn);
      this.cert = await AWS.getParameter(this.options.mtls.cert);
    }

    // Load the CA only if a CA param is provided
    if (!this.ca && this.options.mtls.ca) {
      this.ca = await AWS.getParameter(this.options.mtls.cert);
    }

    return this.privatekey;
  }
}
