import { aws_secretsmanager, Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { ISecret, Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { IStringParameter, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ApiFunction } from './ApiFunction';
import { AuthFunction } from './app/auth/auth-function';
import { HomeFunction } from './app/home/home-function';
import { LoginFunction } from './app/login/login-function';
import { LogoutFunction } from './app/logout/logout-function';
import { PersoonsgegevensFunction } from './app/persoonsgegevens/persoonsgegevens-function';
import { ProductenFunction } from './app/producten/producten-function';
import { TakenFunction } from './app/taken/taken-function';
import { UitkeringFunction } from './app/uitkeringen/uitkering-function';
import { ZakenFunction } from './app/zaken/zaken-function';
import { Configurable, Configuration } from './Configuration';
import { SessionsTable } from './SessionsTable';
import { Statics } from './statics';

interface TLSConfig {
  privateKey: ISecret;
  clientCert: IStringParameter;
  rootCert: IStringParameter;
}

interface HaalCentraalConfig {
  apiKey: ISecret;
  privateKey: ISecret;
  clientCert: IStringParameter;
}

interface OpenKlantConfig {
  apiKey: ISecret;
  endpoint: IStringParameter;
}

export interface ApiStackProps extends StackProps, Configurable {
  sessionsTable: SessionsTable;
  branch: string;
  // zone: HostedZone;
}

/**
 * The API Stack creates the API Gateway and related
 * lambda's. It requires supporting resources (such as the
 * DynamoDB sessions table to be provided and thus created first)
 */
export class ApiStack extends Stack implements Configurable {
  private sessionsTable: Table;
  private zakenApiKey?: ISecret;
  private baseUrl: string;
  configuration: Configuration;
  api: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id);
    this.configuration = props.configuration;
    this.sessionsTable = props.sessionsTable.table;
    this.api = new apigatewayv2.HttpApi(this, 'mijnuitkering-api', {
      description: 'Mijn Uitkering webapplicatie',
    });

    // Store apigateway ID to be used in other stacks
    new StringParameter(this, 'ssm_api_1', {
      stringValue: this.api.httpApiId,
      parameterName: Statics.ssmApiGatewayId,
    });

    const subdomain = Statics.subDomain(props.branch);
    this.baseUrl = `https://${subdomain}.nijmegen.nl`;

    this.setFunctions(props.configuration);
  }

  /**
   * Create and configure lambda's for all api routes, and
   * add routes to the gateway.
   * @param {string} baseUrl the application url
   */
  setFunctions(configuration: Configuration) {
    const tlsConfig = this.mtlsConfig(); // Note also used for uitkeringen endpoint
    const haalCentraalConfig = this.haalCentraalConfig();
    const openKlantConfig = this.openKlantConfig();
    /**
     * The login function generates a login URL and renders the login page.
     */
    const loginFunction = this.loginFunction();

    /**
     * The logout-function sets logout, unsets the session object and renders the logged-out page.
     */
    const logoutFunction = this.logoutFunction();

    /**
     * The auth function receives the callback from the OIDC-provider, validates the received ID-Token, and sets the session to loggedin.
     */
    const authFunction = this.authFunction(haalCentraalConfig, openKlantConfig);

    /**
     * The Home function show the homepage.
     */
    const homeFunction = this.homeFunction();

    /**
     * The Persoonsgegevens function show the homepage.
     */
    const persoonsGegevensFunction = this.persoonsgegevensFunction(haalCentraalConfig, openKlantConfig);

    /**
     * The uitkeringenfunction show your current uitkering.
     */
    const uitkeringenFunction = this.uitkeringenFunction(tlsConfig);


    /**
     * The zaken function show your current zaken.
     */
    const zakenFunction = this.zakenFunction();

    /**
     * The taken function show your current taken.
     */
    const takenFunction = this.takenFunction();

    /**
     * The taken function show your current zaken.
     */
    // const takenFunction = this.takenFunction();

    //MARK: Routes
    this.api.addRoutes({
      integration: new HttpLambdaIntegration('login', loginFunction.lambda),
      path: '/login',
      methods: [apigatewayv2.HttpMethod.GET],
    });

    this.api.addRoutes({
      integration: new HttpLambdaIntegration('logout', logoutFunction.lambda),
      path: '/logout',
      methods: [apigatewayv2.HttpMethod.GET],
    });

    this.api.addRoutes({
      integration: new HttpLambdaIntegration('auth', authFunction.lambda),
      path: '/auth',
      methods: [apigatewayv2.HttpMethod.GET],
    });

    this.api.addRoutes({ // Also availabel at / due to CloudFront defaultRootObject
      integration: new HttpLambdaIntegration('home', homeFunction.lambda),
      path: '/home',
      methods: [apigatewayv2.HttpMethod.GET],
    });

    this.api.addRoutes({
      integration: new HttpLambdaIntegration('persoonsgegevens', persoonsGegevensFunction.lambda),
      path: '/persoonsgegevens',
      methods: [apigatewayv2.HttpMethod.GET],
    });

    this.api.addRoutes({
      integration: new HttpLambdaIntegration('uitkeringen', uitkeringenFunction.lambda),
      path: '/uitkeringen',
      methods: [apigatewayv2.HttpMethod.GET],
    });

    new apigatewayv2.HttpRoute(this, 'zaken-route', {
      httpApi: this.api,
      integration: new HttpLambdaIntegration('zaken', zakenFunction.lambda),
      routeKey: apigatewayv2.HttpRouteKey.with('/zaken', apigatewayv2.HttpMethod.GET),
    });

    new apigatewayv2.HttpRoute(this, 'taken-route', {
      httpApi: this.api,
      integration: new HttpLambdaIntegration('taken', takenFunction.lambda),
      routeKey: apigatewayv2.HttpRouteKey.with('/taken', apigatewayv2.HttpMethod.GET),
    });

    new apigatewayv2.HttpRoute(this, 'zaak-route', {
      httpApi: this.api,
      integration: new HttpLambdaIntegration('zaak', zakenFunction.lambda),
      routeKey: apigatewayv2.HttpRouteKey.with('/zaken/{zaaksource}/{zaakid}', apigatewayv2.HttpMethod.GET),
    });

    new apigatewayv2.HttpRoute(this, 'download-route', {
      httpApi: this.api,
      integration: new HttpLambdaIntegration('zaak', zakenFunction.lambda),
      routeKey: apigatewayv2.HttpRouteKey.with('/zaken/{zaaksource}/{zaakid}/download/{file+}', apigatewayv2.HttpMethod.GET),
    });

    new apigatewayv2.HttpRoute(this, 'download-taak-route', {
      httpApi: this.api,
      integration: new HttpLambdaIntegration('zaak', zakenFunction.lambda),
      routeKey: apigatewayv2.HttpRouteKey.with('/zaken/{zaaksource}/{zaakid}/taak/{taakid}/download/{file+}', apigatewayv2.HttpMethod.GET),
    });

    if (configuration.mijnProductenLive) {
      const productenFunction = this.productenFunction();
      this.api.addRoutes({
        integration: new HttpLambdaIntegration('producten', productenFunction.lambda),
        path: '/producten',
        methods: [apigatewayv2.HttpMethod.GET],
      });
      this.api.addRoutes({
        integration: new HttpLambdaIntegration('producten-id', productenFunction.lambda),
        path: '/producten/{productid}',
        methods: [apigatewayv2.HttpMethod.GET],
      });
      this.grantZakenApiAccess(productenFunction);
    }
  }

  private mtlsConfig() {
    const privateKey = aws_secretsmanager.Secret.fromSecretNameV2(this, 'tls-key-secret', Statics.secretMTLSPrivateKey);
    const clientCert = StringParameter.fromStringParameterName(this, 'tlskey', Statics.ssmMTLSClientCert);
    const rootCert = StringParameter.fromStringParameterName(this, 'tlsrootca', Statics.ssmMTLSRootCA);
    const tlsConfig = { privateKey, clientCert, rootCert };
    return tlsConfig;
  }

  private haalCentraalConfig(): HaalCentraalConfig {
    const brpHaalCentraalApiKeySecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'brp-haal-centraal-api-key-auth-secret', Statics.ssmHaalCentraalApiKey);
    const brpHaalCentraalPrivateKeySecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'brp-haal-centraal-private-key-secret', Statics.ssmHaalCentraalPrivateKey);
    const brpHaalCentraalCertParameter = StringParameter.fromStringParameterName(this, 'brp-haal-centraal-cert', Statics.ssmHaalCentraalCert);
    return {
      privateKey: brpHaalCentraalPrivateKeySecret,
      clientCert: brpHaalCentraalCertParameter,
      apiKey: brpHaalCentraalApiKeySecret,
    };
  }

  private openKlantConfig(): OpenKlantConfig {
    const openKlantApiKey = Secret.fromSecretNameV2(this, 'openklant-api-key', Statics.ssmOpenKlantSecret);
    const openKlantEndpoint = StringParameter.fromStringParameterName(this, 'openklant-endpoint', Statics.ssmOpenKlantEndpoint);
    return {
      apiKey: openKlantApiKey,
      endpoint: openKlantEndpoint,
    };
  }

  private logoutFunction() {
    return new ApiFunction(this, 'logout-function', {
      description: 'Uitlog-pagina voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/logout',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      environment: {
        NODE_OPTIONS: this.configuration.nodeOptions ?? '',
      },
      apiFunction: LogoutFunction,
    });
  }

  private loginFunction() {
    const oidcSecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'oidc-secret-login', Statics._OIDCClientSecret);

    const loginFunction = new ApiFunction(this, 'login-function', {
      description: 'Login-pagina voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/login',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      apiFunction: LoginFunction,
      environment: {
        // OIDC connection
        OIDC_CLIENT_SECRET_ARN: oidcSecret.secretArn,
        OIDC_CLIENT_ID: StringParameter.valueForStringParameter(this, Statics._OIDCClientID),
        OIDC_WELL_KNOWN: StringParameter.valueForStringParameter(this, Statics._OIDCClientWellKnown),
        OIDC_REDIRECT_URL: StringParameter.valueForStringParameter(this, Statics._OIDCClientRedirectUrl),

        DIGID_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmDIGIDScope),
        YIVI_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmYiviScope),
        EHERKENNING_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmEherkenningScope),
        YIVI_BSN_ATTRIBUTE: StringParameter.valueForStringParameter(this, Statics.ssmYiviBsnAttribute),
        YIVI_CONDISCON_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmYiviCondisconScope),
        USE_YIVI_KVK: StringParameter.valueForStringParameter(this, Statics.ssmUseYiviKvk), // Feature flag for kvk bsn conditional disclosure
        NODE_OPTIONS: this.configuration.nodeOptions ?? '',
      },
    });
    oidcSecret.grantRead(loginFunction.lambda);
    return loginFunction;
  }

  private homeFunction() {
    const homeFunction = new ApiFunction(this, 'home-function', {
      description: 'Home-lambda voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/home',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      apiFunction: HomeFunction,
      functionProps: {
        timeout: Duration.seconds(15), // frontend async calls can take a while
        memorySize: 1024,
      },
      environment: {
        SHOW_TAKEN: this.configuration.zakenUseTaken ? 'True' : 'False',
        CONTACTGEGEVENS_LIVE: this.configuration.mijnContactGegevensLive ? 'True' : 'False',
        SHOW_PRODUCTEN: this.configuration.mijnProductenLive ? 'True' : 'False',
        NODE_OPTIONS: this.configuration.nodeOptions ?? '',
      },
    });

    if (this.configuration.useZakenFromAggregatorAPI) {
      this.grantZakenApiAccess(homeFunction);
    }
    return homeFunction;
  }

  private authFunction(haalCentraalConfig: HaalCentraalConfig, openKlantConfig: OpenKlantConfig) {
    const oidcSecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'oidc-secret-auth', Statics._OIDCClientSecret);

    const authFunction = new ApiFunction(this, 'auth-function', {
      description: 'Authenticatie-lambda voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/auth',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      timeout: Duration.seconds(6), // Too long but required for poc authentication service
      environment: {
        // OIDC connection
        OIDC_CLIENT_SECRET_ARN: oidcSecret.secretArn,
        OIDC_CLIENT_ID: StringParameter.valueForStringParameter(this, Statics._OIDCClientID),
        OIDC_WELL_KNOWN: StringParameter.valueForStringParameter(this, Statics._OIDCClientWellKnown),
        OIDC_REDIRECT_URL: StringParameter.valueForStringParameter(this, Statics._OIDCClientRedirectUrl),

        DIGID_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmDIGIDScope),
        EHERKENNING_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmEherkenningScope),
        YIVI_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmYiviScope),
        YIVI_BSN_ATTRIBUTE: StringParameter.valueForStringParameter(this, Statics.ssmYiviBsnAttribute),
        YIVI_KVK_NAME_ATTRIBUTE: StringParameter.valueForStringParameter(this, Statics.ssmYiviKvkNameAttribute),
        YIVI_KVK_NUMBER_ATTRIBUTE: StringParameter.valueForStringParameter(this, Statics.ssmYiviKvkNumberAttribute),
        USE_YIVI_KVK: StringParameter.valueForStringParameter(this, Statics.ssmUseYiviKvk),

        // Haal Centraal
        HAAL_CENTRAAL_CERT_SSM: haalCentraalConfig.clientCert.parameterName,
        HAAL_CENTRAAL_PRIVATE_KEY_ARN: haalCentraalConfig.privateKey.secretArn,
        HAAL_CENTRAAL_API_KEY_ARN: haalCentraalConfig.apiKey.secretArn,
        HAAL_CENTRAAL_BASE_URL: StringParameter.valueForStringParameter(this, Statics.ssmHaalCentraalBaseUrl),

        // OpenKlant
        OPENKLANT_API_KEY_ARN: openKlantConfig.apiKey.secretArn,
        OPENKLANT_API_ENDPOINT: openKlantConfig.endpoint.parameterName,
        CONTACTGEGEVENS_LIVE: this.configuration.mijnContactGegevensLive ? 'True' : 'False',

        NODE_OPTIONS: this.configuration.nodeOptions ?? '',

      },
      apiFunction: AuthFunction,
    });
    haalCentraalConfig.apiKey.grantRead(authFunction.lambda);
    haalCentraalConfig.privateKey.grantRead(authFunction.lambda);
    haalCentraalConfig.clientCert.grantRead(authFunction.lambda);
    openKlantConfig.apiKey.grantRead(authFunction.lambda);
    openKlantConfig.endpoint.grantRead(authFunction.lambda);
    oidcSecret.grantRead(authFunction.lambda);

    return authFunction;
  }

  private persoonsgegevensFunction(haalCentraalConfig: HaalCentraalConfig, openKlantConfig: OpenKlantConfig) {

    const persoonsGegevensFunction = new ApiFunction(this, 'persoonsgegevens-function', {
      description: 'Authenticatie-lambda voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/persoonsgegevens',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      environment: {
        CONTACTGEGEVENS_LIVE: this.configuration.mijnContactGegevensLive ? 'True' : 'False',

        // Haal Centraal
        HAAL_CENTRAAL_CERT_SSM: haalCentraalConfig.clientCert.parameterName,
        HAAL_CENTRAAL_PRIVATE_KEY_ARN: haalCentraalConfig.privateKey.secretArn,
        HAAL_CENTRAAL_API_KEY_ARN: haalCentraalConfig.apiKey.secretArn,
        HAAL_CENTRAAL_BASE_URL: StringParameter.valueForStringParameter(this, Statics.ssmHaalCentraalBaseUrl),

        // OpenKlant
        OPENKLANT_API_KEY_ARN: openKlantConfig.apiKey.secretArn,
        OPENKLANT_API_ENDPOINT: openKlantConfig.endpoint.parameterName,

        NODE_OPTIONS: this.configuration.nodeOptions ?? '',
      },
      apiFunction: PersoonsgegevensFunction,
    });

    haalCentraalConfig.apiKey.grantRead(persoonsGegevensFunction.lambda);
    haalCentraalConfig.privateKey.grantRead(persoonsGegevensFunction.lambda);
    haalCentraalConfig.clientCert.grantRead(persoonsGegevensFunction.lambda);
    openKlantConfig.apiKey.grantRead(persoonsGegevensFunction.lambda);
    openKlantConfig.endpoint.grantRead(persoonsGegevensFunction.lambda);
    return persoonsGegevensFunction;
  }

  private uitkeringenFunction(mtlsConfig: TLSConfig) {
    const uitkeringenFunction = new ApiFunction(this, 'uitkeringen-function', {
      description: 'Uitkeringen-lambda voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/uitkeringen',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      environment: {
        MTLS_PRIVATE_KEY_ARN: mtlsConfig.privateKey.secretArn,
        MTLS_CLIENT_CERT_NAME: mtlsConfig.clientCert.parameterName,
        MTLS_ROOT_CA_NAME: mtlsConfig.rootCert.parameterName,
        UITKERING_API_URL: StringParameter.valueForStringParameter(this, Statics.ssmUitkeringsApiEndpointUrl),
        CONTACTGEGEVENS_LIVE: this.configuration.mijnContactGegevensLive ? 'True' : 'False',
        NODE_OPTIONS: this.configuration.nodeOptions ?? '',
      },
      apiFunction: UitkeringFunction,
    });
    mtlsConfig.privateKey.grantRead(uitkeringenFunction.lambda);
    mtlsConfig.clientCert.grantRead(uitkeringenFunction.lambda);
    mtlsConfig.rootCert.grantRead(uitkeringenFunction.lambda);
    return uitkeringenFunction;
  }


  private zakenFunction() {
    const jwtSecret = Secret.fromSecretNameV2(this, 'jwt-token-secret', Statics.vipJwtSecret);
    const tokenSecret = Secret.fromSecretNameV2(this, 'taken-token-secret', Statics.vipTakenSecret);
    const submissionstorageKey = Secret.fromSecretNameV2(this, 'taken-submission-secret', Statics.submissionstorageKey);
    const zakenFunction = new ApiFunction(this, 'zaken-function', {
      description: 'Zaken-lambda voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/zaken',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      environment: {
        VIP_JWT_SECRET_ARN: jwtSecret.secretArn,
        VIP_TAKEN_SECRET_ARN: tokenSecret.secretArn,
        SUBMISSIONSTORAGE_SECRET_ARN: submissionstorageKey.secretArn,
        VIP_JWT_USER_ID: StringParameter.valueForStringParameter(this, Statics.ssmOpenZaakUserId),
        VIP_JWT_CLIENT_ID: StringParameter.valueForStringParameter(this, Statics.ssmOpenZaakClientId),
        VIP_BASE_URL: StringParameter.valueForStringParameter(this, Statics.ssmOpenZaakBaseUrl),
        VIP_TOKEN_BASE_URL: StringParameter.valueForStringParameter(this, Statics.ssmOpenZaakTakenBaseUrl),
        SUBMISSIONSTORAGE_BASE_URL: StringParameter.valueForStringParameter(this, Statics.ssmSubmissionstorageBaseUrl),
        IS_LIVE: this.configuration.zakenIsLive ? 'true' : 'false',
        USE_TAKEN: this.configuration.zakenUseTaken ? 'true' : 'false',
        SUBMISSIONS_LIVE: this.configuration.zakenUseSubmissions ? 'true' : 'false',
        CONTACTGEGEVENS_LIVE: this.configuration.mijnContactGegevensLive ? 'True' : 'False',
        NODE_OPTIONS: this.configuration.nodeOptions ?? '',
      },
      apiFunction: ZakenFunction,
      functionProps: {
        timeout: Duration.seconds(15),
        memorySize: 1024,
      },
    });

    if (this.configuration.useZakenFromAggregatorAPI) {
      this.grantZakenApiAccess(zakenFunction);
    }

    jwtSecret.grantRead(zakenFunction.lambda);
    tokenSecret.grantRead(zakenFunction.lambda);
    submissionstorageKey.grantRead(zakenFunction.lambda);
    return zakenFunction;
  }

  private grantZakenApiAccess(handlerFunction: ApiFunction) {
    if (!this.zakenApiKey) {
      this.zakenApiKey = Secret.fromSecretNameV2(this, 'zakenapikey', Statics.zaakAggregatorApiGatewayApiKey);
    }
    const apiKey = this.zakenApiKey;
    handlerFunction.lambda.addEnvironment('ZAKEN_APIGATEWAY_BASEURL', StringParameter.valueForStringParameter(this, Statics.ssmZaakAggregatorApiGatewayEndpointUrl));
    handlerFunction.lambda.addEnvironment('ZAKEN_APIGATEWAY_APIKEY', apiKey.secretArn);
    apiKey.grantRead(handlerFunction.lambda);
  }

  private takenFunction() {
    const takenFunction = new ApiFunction(this, 'taken-function', {
      description: 'Taken-lambda voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/taken',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      apiFunction: TakenFunction,
      functionProps: {
        timeout: Duration.seconds(15), // frontend async calls can take a while
        memorySize: 1024,
      },
      environment: {
        SHOW_TAKEN: this.configuration.zakenUseTaken ? 'True' : 'False',
        CONTACTGEGEVENS_LIVE: this.configuration.mijnContactGegevensLive ? 'True' : 'False',
        NODE_OPTIONS: this.configuration.nodeOptions ?? '',
      },
    });

    if (this.configuration.useZakenFromAggregatorAPI) {
      this.grantZakenApiAccess(takenFunction);
    }
    return takenFunction;
  }


  private productenFunction() {
    //TODO open producten secrets
    const arc_key = aws_secretsmanager.Secret.fromSecretNameV2(this, 'arc-key', Statics.ssmProductenArcApiKey);
    const productenFunction = new ApiFunction(this, 'producten-function', {
      description: 'Producten lambda om producten op te halen en tonen',
      codePath: 'app/producten',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      environment: {
        SHOW_PRODUCTEN: this.configuration.mijnProductenLive ? 'True' : 'False',
        SHOW_TAKEN: this.configuration.zakenUseTaken ? 'True' : 'False',
        CONTACTGEGEVENS_LIVE: this.configuration.mijnContactGegevensLive ? 'True' : 'False',
        ARC_BASEURL: StringParameter.valueForStringParameter(this, Statics.ssmProductenArcBaseUrl),
        ARC_APIKEY_ARN: arc_key.secretArn,
        NODE_OPTIONS: this.configuration.nodeOptions ?? '',
      },
      apiFunction: ProductenFunction,
    });
    arc_key.grantRead(productenFunction.lambda);
    return productenFunction;
  }

  /**
   * Clean and return the apigateway subdomain placeholder
   * https://${Token[TOKEN.246]}.execute-api.eu-west-1.${Token[AWS.URLSuffix.3]}/
   * which can't be parsed by the URL class.
   *
   * @returns a domain-like string cleaned of protocol and trailing slash
   */
  domain(): string {
    const url = this.api.url;
    if (!url) { return ''; }
    let cleanedUrl = url
      .replace(/^https?:\/\//, '') //protocol
      .replace(/\/$/, ''); //optional trailing slash
    return cleanedUrl;
  }
}
