import { User } from './User';
import { ZaakConnector, ZaakSummary } from './ZaakConnector';

interface Config {
  zaakConnectors: { [key: string]: ZaakConnector };
}
export class ZaakAggregator {
  private zaakConnectors;

  constructor(config: Config) {
    this.zaakConnectors = config.zaakConnectors;
  }

  public addConnector(name: string, connector: ZaakConnector) {
    this.zaakConnectors[name] = connector;
  }

  async list(user: User): Promise<ZaakSummary[]> {
    const listPromises = Object.values(this.zaakConnectors)
      .map(connector => connector.list(user));
    try {
      const results = await Promise.all(listPromises);
      return results.flat();
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async get(zaakId: string, zaakConnectorId: string, user: User) {
    if (!this.zaakConnectors[zaakConnectorId]) {
      throw Error(`Zaakconnector with id ${zaakConnectorId} not found`);
    }
    const zaak = await this.zaakConnectors[zaakConnectorId].get(zaakId, user);
    return zaak;
  }

  async download(zaakConnectorId: string, zaakId: string, file: string, user: User) {
    if (!this.zaakConnectors[zaakConnectorId]) {
      throw Error(`Zaakconnector with id ${zaakConnectorId} not found`);
    }
    return this.zaakConnectors[zaakConnectorId].download(zaakId, file, user);
  }
}
