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
   * Certificate private key for mTLS
   */
  static readonly secretMTLSPrivateKey: string = '/cdk/mijn-uitkering/mtls-privatekey';

  /**
   * Certificate for mTLS
   */
  static readonly ssmMTLSClientCert: string = '/cdk/mijn-uitkering/mtls-clientcert';

  /**
    * Root CA for mTLS (PKIO root)
    */
  static readonly ssmMTLSRootCA: string = '/cdk/mijn-uitkering/mtls-rootca';

  /**
   * Uitkeringsgegevens API endpoint
   */
  static readonly ssmUitkeringsApiEndpointUrl: string = '/cdk/mijn-uitkering/uitkerings-api-url';

  /**
   * BRP API endpoint
   */
  static readonly ssmBrpApiEndpointUrl: string = '/cdk/mijn-uitkering/brp-api-url';


  /**
   * Route53 Zone ID and name for csp-nijmegen.nl in this account.
   * NB: This depends on the eform-project existing and having set this parameter!
   * We need to use this zone for domain validation purposes. We need to be able to
   * set CNAME DNS-records on the main domain.
   *
   * We need both because a lookup using fromHostedZoneId fails when adding new records,
   * this returns an incomplete iHostedZone (without name).
   */
  static readonly cspRootZoneId: string = '/gemeente-nijmegen/formio/hostedzone/id';
  static readonly cspRootZoneName: string = '/gemeente-nijmegen/formFio/hostedzone/name';


  static subDomain(branch: string) {
    const subdomainMap = {
      acceptance: 'mijn-acc',
      production: 'mijn',
    };
    const subdomain = subdomainMap[branch as keyof typeof subdomainMap] ?? 'mijn-dev';
    return subdomain;
  }

}