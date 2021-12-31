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
}