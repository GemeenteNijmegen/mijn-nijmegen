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
  constructor(bsn: Bsn, idToken: string, userName?: string) {
    this.bsn = bsn;
    this.identifier = bsn.bsn;
    this.userName = userName;
    this.idToken = idToken;
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

  constructor(kvk: string, idToken: string, userName?: string) {
    this.kvk = kvk;
    this.identifier = kvk;
    this.userName = userName;
    this.idToken = idToken;
  }
}


export function UserFromSession(session: Session): User {
  const userType = session.getValue('user_type');
  let user: User;
  if (userType == 'organisation') {
    user = new Organisation(session.getValue('identifier'), session.getValue('id_token'), session.getValue('username'));
  } else {
    user = new Person(new Bsn(session.getValue('identifier')), session.getValue('id_token'), session.getValue('username'));
  }
  return user;
}
