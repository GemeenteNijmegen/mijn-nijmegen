import { CfnOutput, Duration, RemovalPolicy, SecretValue, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { FunctionOptions, IFunction } from 'aws-cdk-lib/aws-lambda';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { localConfig } from './localConfig';
import { AuthFunction } from '../../../src/app/auth/auth-function';
import { HomeFunction } from '../../../src/app/home/home-function';
import { LoginFunction } from '../../../src/app/login/login-function';
import { LogoutFunction } from '../../../src/app/logout/logout-function';
import { PersoonsgegevensFunction } from '../../../src/app/persoonsgegevens/persoonsgegevens-function';
import { TakenFunction } from '../../../src/app/taken/taken-function';
import { UitkeringFunction } from '../../../src/app/uitkeringen/uitkering-function';
import { ZakenFunction } from '../../../src/app/zaken/zaken-function';
import { Statics } from '../../../src/statics';

type PageFunctionClass = new (scope: Construct, id: string, props?: FunctionOptions) => IFunction;

/**
 * A stripped-down version of the SessionsStack + ApiStack, meant to be
 * `cdk deploy`'d against MiniStack (github.com/ministackorg/ministack), a
 * local AWS emulator - not against real AWS. See test/local/README.md for
 * what is left out compared to the real stacks and why.
 */
export class LocalMijnNijmegenStack extends Stack {
  private readonly sessionsTable: Table;
  private readonly api: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Same name and keys as SessionsTable, but no customer-managed KMS key
    // and not retained, so a redeploy starts clean.
    this.sessionsTable = new Table(this, 'sessions-table', {
      tableName: Statics.sessionTableName,
      partitionKey: { name: 'sessionid', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.api = new apigatewayv2.HttpApi(this, 'api', {
      apiName: 'local-mijn-nijmegen-api',
      description: '[LOCAL] Mijn Nijmegen webapplicatie',
    });
    // Pin the API id so the invoke URL is stable across redeploys - see
    // MiniStack's `ms-custom-id` tag.
    Tags.of(this.api).add('ms-custom-id', localConfig.apiId);

    // Secrets and parameters the lambdas read at runtime, under the same
    // names as in production.
    const oidcClientSecret = this.secret('oidc-client-secret', Statics._OIDCClientSecret, localConfig.oidc.clientSecret);
    const haalCentraalApiKey = this.secret('haal-centraal-api-key', Statics.ssmHaalCentraalApiKey, localConfig.unusedSecretValue);
    const haalCentraalPrivateKey = this.secret('haal-centraal-private-key', Statics.ssmHaalCentraalPrivateKey, localConfig.unusedSecretValue);
    const haalCentraalCert = new StringParameter(this, 'haal-centraal-cert', {
      parameterName: Statics.ssmHaalCentraalCert,
      stringValue: localConfig.unusedSecretValue,
    });
    const zakenApiKey = this.secret('zaken-api-key', Statics.zaakAggregatorApiGatewayApiKey, localConfig.unusedSecretValue);
    const mtlsPrivateKey = this.secret('mtls-private-key', Statics.secretMTLSPrivateKey, localConfig.unusedSecretValue);
    const mtlsClientCert = new StringParameter(this, 'mtls-client-cert', {
      parameterName: Statics.ssmMTLSClientCert,
      stringValue: localConfig.unusedSecretValue,
    });
    const mtlsRootCa = new StringParameter(this, 'mtls-root-ca', {
      parameterName: Statics.ssmMTLSRootCA,
      stringValue: localConfig.unusedSecretValue,
    });
    // Only passed to the zaken lambda to match ApiStack, the handler doesn't
    // read them (it gets everything from the zaakaggregator).
    const vipJwtSecret = this.secret('vip-jwt-secret', Statics.vipJwtSecret, localConfig.unusedSecretValue);
    const vipTakenSecret = this.secret('vip-taken-secret', Statics.vipTakenSecret, localConfig.unusedSecretValue);
    const submissionstorageKey = this.secret('submissionstorage-key', Statics.submissionstorageKey, localConfig.unusedSecretValue);

    const haalCentraalEnvironment = {
      HAAL_CENTRAAL_CERT_SSM: haalCentraalCert.parameterName,
      HAAL_CENTRAAL_PRIVATE_KEY_ARN: haalCentraalPrivateKey.secretArn,
      HAAL_CENTRAAL_API_KEY_ARN: haalCentraalApiKey.secretArn,
      HAAL_CENTRAAL_BASE_URL: localConfig.backends.haalCentraalBaseUrl,
    };

    const zakenApiEnvironment = {
      ZAKEN_APIGATEWAY_BASEURL: localConfig.backends.zaakAggregatorBaseUrl,
      ZAKEN_APIGATEWAY_APIKEY: zakenApiKey.secretArn,
    };

    const oidcEnvironment = {
      OIDC_CLIENT_SECRET_ARN: oidcClientSecret.secretArn,
      OIDC_CLIENT_ID: localConfig.oidc.clientId,
      OIDC_WELL_KNOWN: localConfig.oidc.wellKnown,
      OIDC_ALLOW_INSECURE_REQUESTS: 'true', // Keycloak runs on plain http
      DIGID_SCOPE: localConfig.oidc.digidScope,
      EHERKENNING_SCOPE: localConfig.oidc.eherkenningScope,
      USE_YIVI_KVK: 'false',
    };

    const loginFunction = this.pageFunction('login', LoginFunction, 'Login-pagina', {
      ...oidcEnvironment,
      OIDC_REDIRECT_URL: `${localConfig.applicationUrl}/auth`,
      // No YIVI_SCOPE: hides the Yivi button, Keycloak doesn't mock Yivi (yet).
      USE_GEMACHTIGD: 'false',
    });
    oidcClientSecret.grantRead(loginFunction);

    const authFunction = this.pageFunction('auth', AuthFunction, 'Authenticatie-lambda', {
      ...oidcEnvironment,
      // The auth lambda builds the callback URL as OIDC_REDIRECT_URL + path,
      // and openid-client sends that as redirect_uri in the token request.
      // Keycloak requires it to equal the redirect_uri the login lambda sent
      // (OIDC_REDIRECT_URL there), hence the application URL without /auth.
      OIDC_REDIRECT_URL: localConfig.applicationUrl,
      // Must not be empty: the login method is derived from the returned
      // scopes with `includes()`, and every string includes ''.
      YIVI_SCOPE: 'yivi',
      ...haalCentraalEnvironment,
      CONTACTGEGEVENS_LIVE: 'False',
    });
    oidcClientSecret.grantRead(authFunction);
    haalCentraalApiKey.grantRead(authFunction);
    haalCentraalPrivateKey.grantRead(authFunction);
    haalCentraalCert.grantRead(authFunction);

    const homeFunction = this.pageFunction('home', HomeFunction, 'Home-lambda', {
      CONTACTGEGEVENS_LIVE: 'False',
      SHOW_PRODUCTEN: 'False',
      ...zakenApiEnvironment,
    });
    zakenApiKey.grantRead(homeFunction);

    const persoonsgegevensFunction = this.pageFunction('persoonsgegevens', PersoonsgegevensFunction, 'Persoonsgegevens-lambda', {
      ...haalCentraalEnvironment,
      // Off until OpenKlant and NotifyNL are mocked: the lambda only sets up
      // their clients (and needs the OPENKLANT_* and NOTIFY_* variables) when on.
      CONTACTGEGEVENS_LIVE: 'False',
    });
    haalCentraalApiKey.grantRead(persoonsgegevensFunction);
    haalCentraalPrivateKey.grantRead(persoonsgegevensFunction);
    haalCentraalCert.grantRead(persoonsgegevensFunction);

    const uitkeringenFunction = this.pageFunction('uitkeringen', UitkeringFunction, 'Uitkeringen-lambda', {
      // The backend is plain http, so axios never uses the https agent these
      // end up in. See localConfig.unusedSecretValue.
      MTLS_PRIVATE_KEY_ARN: mtlsPrivateKey.secretArn,
      MTLS_CLIENT_CERT_NAME: mtlsClientCert.parameterName,
      MTLS_ROOT_CA_NAME: mtlsRootCa.parameterName,
      UITKERING_API_URL: localConfig.backends.uitkeringenUrl,
    });
    mtlsPrivateKey.grantRead(uitkeringenFunction);
    mtlsClientCert.grantRead(uitkeringenFunction);
    mtlsRootCa.grantRead(uitkeringenFunction);

    const zakenFunction = this.pageFunction('zaken', ZakenFunction, 'Zaken-lambda', {
      VIP_JWT_SECRET_ARN: vipJwtSecret.secretArn,
      VIP_TAKEN_SECRET_ARN: vipTakenSecret.secretArn,
      SUBMISSIONSTORAGE_SECRET_ARN: submissionstorageKey.secretArn,
      VIP_JWT_USER_ID: localConfig.unusedSecretValue,
      VIP_JWT_CLIENT_ID: localConfig.unusedSecretValue,
      VIP_BASE_URL: localConfig.unusedSecretValue,
      VIP_TOKEN_BASE_URL: localConfig.unusedSecretValue,
      SUBMISSIONSTORAGE_BASE_URL: localConfig.unusedSecretValue,
      SUBMISSIONS_LIVE: 'false',
      ...zakenApiEnvironment,
    });
    zakenApiKey.grantRead(zakenFunction);
    vipJwtSecret.grantRead(zakenFunction);
    vipTakenSecret.grantRead(zakenFunction);
    submissionstorageKey.grantRead(zakenFunction);

    const takenFunction = this.pageFunction('taken', TakenFunction, 'Taken-lambda', zakenApiEnvironment);
    zakenApiKey.grantRead(takenFunction);

    const logoutFunction = this.pageFunction('logout', LogoutFunction, 'Uitlog-pagina', {});

    this.route('/login', loginFunction);
    this.route('/auth', authFunction);
    this.route('/home', homeFunction); // Also available at / through the proxy
    this.route('/logout', logoutFunction);
    this.route('/persoonsgegevens', persoonsgegevensFunction);
    this.route('/uitkeringen', uitkeringenFunction);
    this.route('/zaken', zakenFunction);
    this.route('/zaken/{zaaksource}/{zaakid}', zakenFunction);
    this.route('/zaken/{zaaksource}/{zaakid}/download/{file+}', zakenFunction);
    this.route('/zaken/{zaaksource}/{zaakid}/taak/{taakid}/download/{file+}', zakenFunction);
    this.route('/taken', takenFunction);

    new CfnOutput(this, 'ApiUrl', { value: this.api.apiEndpoint });
    new CfnOutput(this, 'SessionsTableName', { value: this.sessionsTable.tableName });
  }

  /**
   * Create a page lambda from its projen-generated function class. Used
   * instead of ApiFunction, which adds the Lambda Insights layer, log
   * retention and alarms that are not needed (or not available) locally.
   */
  private pageFunction(name: string, functionClass: PageFunctionClass, description: string, environment: Record<string, string>) {
    const fn = new functionClass(this, `${name}-function`, {
      // Pinned so the log group name is predictable, see scripts/local.sh logs
      functionName: `${localConfig.functionNamePrefix}${name}`,
      description: `[LOCAL] ${description} voor de Mijn Nijmegen-applicatie.`,
      // Generous, as the first invocation also starts a Lambda container
      timeout: Duration.seconds(30),
      memorySize: 1024,
      environment: {
        APPLICATION_URL_BASE: `${localConfig.applicationUrl}/`,
        SESSION_TABLE: this.sessionsTable.tableName,
        OIDC_SCOPE: localConfig.oidc.scope,
        NODE_OPTIONS: '--enable-source-maps',
        ...environment,
      },
    });
    this.sessionsTable.grantReadWriteData(fn);
    return fn;
  }

  private route(path: string, fn: IFunction) {
    this.api.addRoutes({
      integration: new HttpLambdaIntegration(fn.node.id, fn),
      path,
      methods: [apigatewayv2.HttpMethod.GET],
    });
  }

  private secret(id: string, secretName: string, value: string) {
    return new Secret(this, id, {
      secretName,
      secretStringValue: SecretValue.unsafePlainText(value),
    });
  }
}
