export abstract class Statics {
  static readonly projectName: string = 'mijn-nijmegen';
  static readonly sessionTableName: string = 'mijn-nijmegen-sessions';

  /**
   * Repo information
   */

  static readonly repository: string = 'mijn-nijmegen';
  static readonly repositoryOwner: string = 'GemeenteNijmegen';

  /**
   * IAM params
   */
  static readonly iamAccountId: string = '098799052470';
  static readonly ssmReadOnlyRoleArn: string = '/cdk/mijn-nijmegen/role-readonly-arn';

  /**
   * Configuration
   */
  static readonly ssmUseYiviKvk: string = '/cdk/mijn-nijmegen/useYiviKvk';

  // MARK: OpenIDConnect
  /**
   * Authentication URL base, used in auth and login lambda
   */
  static readonly ssmAuthUrlBaseParameter: string = '/cdk/mijn-nijmegen/authUrlBase';
  /**
   * OpenID Connect client ID (sent in URL as querystring-param, not secret)
   */
  static readonly ssmOIDCClientID: string = '/cdk/mijn-nijmegen/authClientID';

  /**
   * OpenID Connect scope
   */
  static readonly ssmOIDCScope: string = '/cdk/mijn-nijmegen/authScope';
  static readonly ssmDIGIDScope: string = '/cdk/mijn-nijmegen/digidScope';
  static readonly ssmYiviScope: string = '/cdk/mijn-nijmegen/yiviScope';
  static readonly ssmEherkenningScope: string = '/cdk/mijn-nijmegen/eHerkenningScope';
  static readonly ssmYiviCondisconScope: string = '/cdk/mijn-nijmegen/yiviCondisconScope';
  static readonly ssmYiviBsnAttribute: string = '/cdk/mijn-nijmegen/yiviBsnAttribute';
  static readonly ssmYiviKvkNameAttribute: string = '/cdk/mijn-nijmegen/yiviKvkNameAttribute';
  static readonly ssmYiviKvkNumberAttribute: string = '/cdk/mijn-nijmegen/yiviKvkNumberAttribute';

  /**
   * OpenID Connect secret name
   */
  static readonly secretOIDCClientSecret: string = '/cdk/mijn-nijmegen/oidc-clientsecret';

  // MARK: API config (mTLS)
  /**
   * Certificate private key for mTLS
   */
  static readonly secretMTLSPrivateKey: string = '/cdk/mijn-nijmegen/mtls-privatekey';

  /**
   * Certificate for mTLS
   */
  static readonly ssmMTLSClientCert: string = '/cdk/mijn-nijmegen/mtls-clientcert';

  /**
    * Root CA for mTLS (PKIO root)
    */
  static readonly ssmMTLSRootCA: string = '/cdk/mijn-nijmegen/mtls-rootca';

  /**
   * BRP API endpoint
   */
  static readonly ssmBrpApiEndpointUrl: string = '/cdk/mijn-nijmegen/brp-api-url';

  /**
   * Uitkeringsgegevens API endpoint
   */
  static readonly ssmUitkeringsApiEndpointUrl: string = '/cdk/mijn-nijmegen/uitkerings-api-url';

  // MARK: DNS
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

  // Managed in dns-managment project:
  // Below references the new hosted zone separeted from webformulieren
  static readonly accountRootHostedZonePath: string = '/gemeente-nijmegen/account/hostedzone';
  static readonly accountRootHostedZoneId: string = '/gemeente-nijmegen/account/hostedzone/id';
  static readonly accountRootHostedZoneName: string = '/gemeente-nijmegen/account/hostedzone/name';
  // The KSM key parameters for each account
  static readonly ssmAccountDnsSecKmsKey: string = '/gemeente-nijmegen/account/dnssec/kmskey/arn';


  /**
   * Route53 Zone ID and name for the zone for Mijn Nijmegen. decouples stacks to not pass
   * the actual zone between stacks. This param is set by DNSStack and should not be modified after.
   */
  static readonly ssmZonePath: string = '/cdk/mijn-nijmegen/zones';
  static readonly ssmZoneId: string = '/cdk/mijn-nijmegen/zone-id';
  static readonly ssmZoneName: string = '/cdk/mijn-nijmegen/zone-name';
  static readonly ssmZoneIdNew: string = '/cdk/mijn-nijmegen/zones/csp-id';
  static readonly ssmZoneNameNew: string = '/cdk/mijn-nijmegen/zones/csp-name';

  /** There seems to be no way to get the required ds record value in the CDK/API */
  static readonly ssmNijmegenDSRecordValue: string = '/cdk/mijn-nijmegen/ds-record-value';

  static readonly certificatePath: string = '/cdk/mijn-nijmegen/certificates';
  static readonly certificateArn: string = '/cdk/mijn-nijmegen/certificates/certificate-arn';

  // MARK: Application infrastructure
  static readonly ssmApiGatewayId: string = '/cdk/mijn-nijmegen/apigateway-id';

  static readonly ssmSessionsTableArn: string = '/cdk/mijn-nijmegen/sessionstable-arn';

  static readonly ssmDataKeyArn: string = '/cdk/mijn-nijmegen/kms-datakey-arn';

  static readonly wafPath: string = '/cdk/mijn-nijmegen/waf';
  static readonly ssmWafAclArn: string = '/cdk/mijn-nijmegen/waf/acl-arn';

  static readonly ssmMonitoringLambdaArn: string = '/cdk/mijn-nijmegen/monitoring-lambda-arn';
  static readonly ssmSlackWebhookUrl: string = '/cdk/mijn-nijmegen/slack-webhook-url';

  // MARK: ZGW configuration

  static readonly ssmOpenZaakUserId: string = '/cdk/mijn-nijmegen/vip-jwt-userid';
  static readonly ssmOpenZaakClientId: string = '/cdk/mijn-nijmegen/vip-jwt-clientid';
  static readonly ssmOpenZaakBaseUrl: string = '/cdk/mijn-nijmegen/vip-base-url';
  static readonly ssmOpenZaakTakenBaseUrl: string = '/cdk/mijn-nijmegen/taken-base-url';

  static readonly ssmSubmissionstorageBaseUrl: string = '/cdk/mijn-nijmegen/submissionstorage-base-url';
  /**
   * Secrets for zaken
   */
  static readonly vipJwtSecret: string = '/cdk/mijn-nijmegen/vip-jwttoken-new';
  static readonly vipTakenSecret: string = '/cdk/mijn-nijmegen/vip-takentoken-new';

  static readonly submissionstorageKey: string = '/cdk/mijn-nijmegen/submissionstorage-key';

  /**
   * PoC authentication service
   */
  static readonly authServiceClientSecretArn = '/cdk/mijn-nijmegen/auth=service-client-secret-arn';

  // MARK: ENVIRONMENTS
  static readonly gnBuildEnvironment = {
    account: '836443378780',
    region: 'eu-central-1',
  };

  static readonly gnMijnNijmegenDevEnvironment = {
    account: '590184009539',
    region: 'eu-central-1',
  };

  static readonly gnMijnNijmegenAccpEnvironment = {
    account: '021929636313',
    region: 'eu-central-1',
  };

  static readonly gnMijnNijmegenProdEnvironment = {
    account: '740606269759',
    region: 'eu-central-1',
  };

  static subDomain(branch: string) {
    const subdomainMap = {
      development: undefined,
      acceptance: 'mijn.accp',
      production: 'mijn',
    };
    const subdomain = subdomainMap[branch as keyof typeof subdomainMap];
    return subdomain;
  }

  static cspSubDomain(branch: string) {
    const subdomainMap = {
      development: 'mijn.mijn-dev',
      acceptance: 'mijn.mijn-accp',
      production: 'mijn.mijn-prod',
    };
    const subdomain = subdomainMap[branch as keyof typeof subdomainMap];
    if (!subdomain) {
      throw Error(`No subdomain configured for branch ${branch}`);
    }
    return subdomain;
  }
}
