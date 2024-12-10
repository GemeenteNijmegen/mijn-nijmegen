import { Session } from '@gemeentenijmegen/session';

export async function validateToken(session: Session, token: string) {
  const xsrf_token = session.getValue('xsrf_token');
  const invalid_xsrf_token = xsrf_token == undefined || xsrf_token !== token;
  if (invalid_xsrf_token) {
    console.warn('xsrf tokens do not match');
    return false;
  }
  return true;
}
