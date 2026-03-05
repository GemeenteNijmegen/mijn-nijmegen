import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';
import { HaalCentraalApi } from './HaalCentraalApi';

export interface UserConfig {
  haalCentraal: HaalCentraalApi;
}

/**
 * Several types of user exist:
 * - 'Natuurlijk persoon' (a human), having a BSN and a name (provided by the BRP)
 * - 'Organisation', having a KVK identification number, and a company name (provided by eherkenning)
 */
export interface User {
  identifier: string;
  type: 'person' | 'organisation';
  email?: string;
  phonenumber?: string;
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
  email?: string;
  phonenumber?: string;
  type: 'person';
  constructor(bsn: Bsn, config: UserConfig | undefined, userName?: string, email?: string, phonenumber?: string) {
    this.bsn = bsn;
    this.identifier = bsn.bsn;
    this.config = config;
    this.userName = userName;
    this.email = email;
    this.phonenumber = phonenumber;
    this.type = 'person';
  }

  async getUserName(): Promise<string> {
    if (typeof this.userName !== 'string') {
      if (!this.config) {
        throw Error('No config provided for user and username is not known');
      }
      try {
        const brpName = await this.config.haalCentraal.getName(this.bsn);
        this.userName = brpName ?? 'Onbekende gebruiker';
      } catch {
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
  email?: string;
  phonenumber?: string;
  type: 'organisation';

  constructor(kvk: string, userName: string, email?: string, phonenumber?: string) {
    this.kvk = kvk;
    this.identifier = kvk;
    this.userName = userName ?? kvk;
    this.email = email;
    this.phonenumber = phonenumber;
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
  const email = session.getValue('email');
  const phonenumber = session.getValue('phonenumber');
  let user: User;
  if (userType == 'organisation') {

    user = new Organisation(identifier, username, email, phonenumber);
  } else {
    user = new Person(new Bsn(session.getValue('identifier')), undefined, username, email, phonenumber);
  }
  return user;
}