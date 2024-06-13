import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';

/**
 * Several types of user exist:
 * - 'Natuurlijk persoon' (a human), having a BSN and a name (provided by the BRP)
 * - 'Organisation', having a KVK identification number, and a company name (provided by eherkenning)
 */
export interface User {
  identifier: string;
  type: 'person' | 'organisation';
  idToken: string;
  userName?: string;
  delegatedToken: string;
}

/**
 * Implementation of a 'natuurlijk persoon', a human, having a BSN.
 */
export class Person implements User {
  bsn: Bsn;
  identifier: string;
  idToken: string;
  userName?: string;
  type: 'person' | 'organisation' = 'person';
  delegatedToken: string;

  constructor(bsn: Bsn, idToken: string, delegatedToken: string, userName?: string) {
    this.bsn = bsn;
    this.identifier = bsn.bsn;
    this.userName = userName;
    this.idToken = idToken;
    this.delegatedToken = delegatedToken;
  }
}

/**
 * Implementation of a user of type 'organisation', having a KVK number.
 */
export class Organisation implements User {
  kvk: string;
  identifier: string;
  idToken: string;
  type: 'person' | 'organisation' = 'organisation';
  userName?: string;
  delegatedToken: string;

  constructor(kvk: string, idToken: string, delegatedToken: string, userName?: string) {
    this.kvk = kvk;
    this.identifier = kvk;
    this.userName = userName;
    this.idToken = idToken;
    this.delegatedToken = delegatedToken;
  }
}


export function UserFromSession(session: Session): User {
  const userType = session.getValue('user_type');
  let user: User;
  if (userType == 'organisation') {
    user = new Organisation(session.getValue('identifier'), session.getValue('id_token'), session.getValue('delegated_token'), session.getValue('username'));
  } else {
    user = new Person(new Bsn(session.getValue('identifier')), session.getValue('id_token'), session.getValue('delegated_token'), session.getValue('username'));
  }
  return user;
}
