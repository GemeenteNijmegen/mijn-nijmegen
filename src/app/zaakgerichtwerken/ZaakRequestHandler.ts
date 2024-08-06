import { AWS } from '@gemeentenijmegen/utils';
import { Inzendingen } from '../zaken/Inzendingen';
import { OpenZaakClient } from '../zaken/OpenZaakClient';
import { User } from '../zaken/User';
import { ZaakAggregator } from '../zaken/ZaakAggregator';
import { Zaken } from '../zaken/Zaken';

export class ZaakRequestHandler {
  private openZaakClient?: OpenZaakClient;
  private zaakAggregator?: ZaakAggregator;

  async initSecret() {
    if (!process.env.VIP_JWT_SECRET_ARN || !process.env.VIP_TAKEN_SECRET_ARN || !process.env.SUBMISSIONSTORAGE_SECRET_ARN) {
      throw Error('No secret ARN provided');
    }
    return {
      vipSecret: await AWS.getSecret(process.env.VIP_JWT_SECRET_ARN),
      takenSecret: await AWS.getSecret(process.env.VIP_TAKEN_SECRET_ARN),
      submissionstorageSecret: await AWS.getSecret(process.env.SUBMISSIONSTORAGE_SECRET_ARN),
    };
  }

  async setup() {
    if (!this.openZaakClient) {
      if (!process.env.ALLOWED_ZAKEN_DOMAINS) {
        throw Error('Allowed zaken domains must be set');
      }
      const secrets = await this.initSecret();
      this.openZaakClient = this.createOpenZaakClient(secrets.vipSecret);
      const zaken = new Zaken(this.openZaakClient, { zaakConnectorId: 'zaak', show_documents: process.env.SHOW_DOCUMENTS == 'True' });
      const submissions = this.inzendingen(secrets.submissionstorageSecret);
      const domains = process.env.ALLOWED_ZAKEN_DOMAINS.split(',').map(domain => domain.trim());
      zaken.allowDomains(domains);

      this.zaakAggregator = new ZaakAggregator({
        zaakConnectors: {
          zaak: zaken,
          inzendingen: submissions,
        },
      });
    }
  }

  createOpenZaakClient(secret: string): OpenZaakClient {
    if (!this.openZaakClient) {
      if (!process.env.VIP_BASE_URL) {
        throw Error('no base url set');
      }
      this.openZaakClient = new OpenZaakClient({
        baseUrl: new URL(process.env.VIP_BASE_URL),
        clientId: process.env.VIP_JWT_CLIENT_ID,
        userId: process.env.VIP_JWT_USER_ID,
        secret,
      });
    }
    return this.openZaakClient;
  }


  /**
   * Setup the inzendingen-functionality, which retrieves
   * submissions from webformulieren-storage.
   *
   * @param accessKey API key for inzendingen api
   */
  inzendingen(accessKey: string) {
    if (!process.env.SUBMISSIONSTORAGE_BASE_URL) {
      throw Error('SUBMISSIONSTORAGE_BASE_URL must be set');
    }
    return new Inzendingen({ baseUrl: process.env.SUBMISSIONSTORAGE_BASE_URL, accessKey });
  }

  async list(user: User) {
    if (!this.zaakAggregator) {
      await this.setup();
    }
    if (!this.zaakAggregator) {
      throw Error('setup failed');
    }
    return this.zaakAggregator.list(user);
  }
};
