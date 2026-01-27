import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';
import { BrpApi } from './BrpApi';
import { HaalCentraalApi } from './HaalCentraalApi';

export interface UserConfig {
  apiClient: ApiClient;
  haalCentraal?: HaalCentraalApi;
}

/**
 * Several types of user exist:
 * - 'Natuurlijk persoon' (a human), having a BSN and a name (provided by the BRP)
 * - 'Organisation', having a KVK identification number, and a company name (provided by eherkenning)
 */
export interface User {
  identifier: string;
  type: 'person' | 'organisation';
  getUserName(): Promise<string>;
}

/**
 * Implementation of a 'natuurlijk persoon', a human, having a BSN.
 */
export class Person implements User {
  bsn: Bsn;
  config?: UserConfig;
  identifier: string;
  userName?: string;
  type: 'person';
  constructor(bsn: Bsn, config: UserConfig | undefined, userName?: string) {
    this.bsn = bsn;
    this.identifier = bsn.bsn;
    this.config = config;
    this.userName = userName;
    this.type = 'person';
  }

  async getUserName(): Promise<string> {
    if (typeof this.userName !== 'string') {
      if (!this.config) {
        throw Error('No config provided for user and username is not known');
      }
      try {
        if (this.config.haalCentraal) {
          const brpName = await this.config.haalCentraal.getName(this.bsn);
          this.userName = brpName ?? 'Onbekende gebruiker';
        } else {
          const brpApi = new BrpApi(this.config.apiClient);
          const brpData = await brpApi.getBrpData(this.bsn.bsn);
          this.userName = brpData?.Persoon?.Persoonsgegevens?.Naam ? brpData.Persoon.Persoonsgegevens.Naam : 'Onbekende gebruiker';
        }
      } catch (error) {
        console.error('Error getting username');
        this.userName = 'Onbekende gebruiker';
      }
    }
    return this.userName as string;
  }
}

/**
 * Implementation of a user of type 'organisation', having a KVK number.
 */
export class Organisation implements User {
  kvk: string;
  identifier: string;
  userName: string;
  type: 'organisation';

  constructor(kvk: string, userName: string) {
    this.kvk = kvk;
    this.identifier = kvk;
    this.userName = userName ?? kvk;
    this.type = 'organisation';
  }

  async getUserName(): Promise<string> {
    return this.userName;
  }
}


export function UserFromSession(session: Session): User {
  const userType = session.getValue('user_type');
  const username = session.getValue('username');
  const identifier = session.getValue('identifier');
  let user: User;
  if (userType == 'organisation') {

    user = new Organisation(identifier, username);
  } else {
    user = new Person(new Bsn(session.getValue('identifier')), undefined, session.getValue('username'));
  }
  return user;
}