export abstract class Statics {
  static readonly projectName: string = 'mijn-uitkering';
  static readonly sessionTableName: string = 'mijn-uitkering-sessions';

  /**
   * Authentication URL base, used in auth and login lambda
   */
  static readonly ssmAuthUrlBaseParameter: string = '/cdk/mijn-uitkering/authUrlBase';
  /**
   * OpenID Connect client ID (sent in URL as querystring-param, not secret)
   */
  static readonly ssmOIDCClientID: string = '/cdk/mijn-uitkering/authClientID';
  /**
   * OpenID Connect scope
   */
  static readonly ssmOIDCScope: string = '/cdk/mijn-uitkering/authScope';

  /**
   * OpenID Connect secret name
   */
  static readonly secretOIDCClientSecret: string = '/cdk/mijn-uitkering/oidc-clientsecret';

  /**
   * Route53 Zone ID for csp-nijmegen.nl in this account.
   * NB: This depends on the eform-project existing and having set this parameter!
   * We need to use this zone for domain validation purposes. We need to be able to 
   * set TXT DNS-records on the main domain.
   */
  static readonly cspRootZoneId: string = '/gemeente-nijmegen/formio/hostedzone/id';
}