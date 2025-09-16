import { aws_secretsmanager, Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { ISecret, Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { IStringParameter, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ApiFunction } from './ApiFunction';
import { AuthFunction } from './app/auth/auth-function';
import { ContactgegevensFunction } from './app/contactgegevens/contactgegevens-function';
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
    const tlsConfig = this.mtlsConfig();
    const haalCentraalConfig = this.haalCentraalConfig();
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
    const authFunction = this.authFunction(tlsConfig, haalCentraalConfig);

    /**
     * The Home function show the homepage.
     */
    const homeFunction = this.homeFunction();

    /**
     * The Persoonsgegevens function show the homepage.
     */
    const persoonsGegevensFunction = this.persoonsgegevensFunction(tlsConfig, haalCentraalConfig);

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

    if (configuration.mijnContactGegevensLive) {
      const contactgegevensFunction = this.contactgegevensFunction();
      this.api.addRoutes({
        integration: new HttpLambdaIntegration('contactgegevens', contactgegevensFunction.lambda),
        path: '/contactgegevens',
        methods: [apigatewayv2.HttpMethod.GET],
      });
      this.api.addRoutes({
        integration: new HttpLambdaIntegration('contactgegevens-edit', contactgegevensFunction.lambda),
        path: '/contactgegevens/edit',
        methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      });
      this.api.addRoutes({
        integration: new HttpLambdaIntegration('contactgegevens-verify', contactgegevensFunction.lambda),
        path: '/contactgegevens/verify',
        methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      });
    }

    if (configuration.mijnProductenLive) {
      const productenFunction = this.productenFunction();
      this.api.addRoutes({
        integration: new HttpLambdaIntegration('producten', productenFunction.lambda),
        path: '/producten',
        methods: [apigatewayv2.HttpMethod.GET],
      });
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

  private logoutFunction() {
    return new ApiFunction(this, 'logout-function', {
      description: 'Uitlog-pagina voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/logout',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      apiFunction: LogoutFunction,
    });
  }

  private loginFunction() {
    return new ApiFunction(this, 'login-function', {
      description: 'Login-pagina voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/login',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      apiFunction: LoginFunction,
      environment: {
        DIGID_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmDIGIDScope),
        YIVI_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmYiviScope),
        EHERKENNING_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmEherkenningScope),
        YIVI_BSN_ATTRIBUTE: StringParameter.valueForStringParameter(this, Statics.ssmYiviBsnAttribute),
        YIVI_CONDISCON_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmYiviCondisconScope),
        USE_YIVI_KVK: StringParameter.valueForStringParameter(this, Statics.ssmUseYiviKvk), // Feature flag for kvk bsn conditional disclosure

        // VerId configuration (without secret as its not used to create the url)
        USE_NL_WALLET_VERID: this.configuration.nlWalletVerIdIsLive ? 'true' : 'false',
        NL_WALLET_VERID_CLIENT_ID: StringParameter.valueForStringParameter(this, Statics.ssmVerIdClientId),
        NL_WALLET_VERID_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmVerIdScope),
        NL_WALLET_VERID_WELL_KNOWN: StringParameter.valueForStringParameter(this, Statics.ssmVerIdWellKnown),

        // NL Wallet - Signicat configuration
        USE_NL_WALLET_SIGNICAT: this.configuration.nlWalletSignicatIsLive ? 'true' : 'false',
        NL_WALLET_SIGNICAT_CLIENT_ID: StringParameter.valueForStringParameter(this, Statics.ssmSignicatClientId),
        NL_WALLET_SIGNICAT_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmSignicatScope),
        NL_WALLET_SIGNICAT_WELL_KNOWN: StringParameter.valueForStringParameter(this, Statics.ssmSignicatWellKnown),
      },
    });
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
        SHOW_CONTACTGEGEVENS: this.configuration.mijnContactGegevensLive ? 'True' : 'False',
      },
    });

    if (this.configuration.useZakenFromAggregatorAPI) {
      this.grantZakenApiAccess(homeFunction);
    }
    return homeFunction;
  }

  private authFunction(mtlsConfig: TLSConfig, haalCentraalConfig: HaalCentraalConfig) {
    const oidcSecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'oidc-secret', Statics.secretOIDCClientSecret);
    const authServiceClientSecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'auth-serice-client-secret', Statics.authServiceClientSecretArn);
    const verIdClientSecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'verid-client-secret', Statics.ssmVerIdClientSecret);
    const signicatClientSecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'signicat-client-secret', Statics.ssmSignicatClientSecret);

    const authFunction = new ApiFunction(this, 'auth-function', {
      description: 'Authenticatie-lambda voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/auth',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      timeout: Duration.seconds(6), // Too long but required for poc authentication service
      environment: {
        CLIENT_SECRET_ARN: oidcSecret.secretArn,
        MTLS_PRIVATE_KEY_ARN: mtlsConfig.privateKey.secretArn,
        MTLS_CLIENT_CERT_NAME: mtlsConfig.clientCert.parameterName,
        MTLS_ROOT_CA_NAME: mtlsConfig.rootCert.parameterName,
        BRP_API_URL: StringParameter.valueForStringParameter(this, Statics.ssmBrpApiEndpointUrl),
        DIGID_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmDIGIDScope),
        EHERKENNING_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmEherkenningScope),
        YIVI_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmYiviScope),
        YIVI_BSN_ATTRIBUTE: StringParameter.valueForStringParameter(this, Statics.ssmYiviBsnAttribute),
        YIVI_KVK_NAME_ATTRIBUTE: StringParameter.valueForStringParameter(this, Statics.ssmYiviKvkNameAttribute),
        YIVI_KVK_NUMBER_ATTRIBUTE: StringParameter.valueForStringParameter(this, Statics.ssmYiviKvkNumberAttribute),
        USE_YIVI_KVK: StringParameter.valueForStringParameter(this, Statics.ssmUseYiviKvk),
        USE_AUTH_SERVICE: this.configuration.authenticationServiceConfiguration ? 'true' : 'false',
        AUTH_SERVICE_CLIENT_SECRET_ARN: authServiceClientSecret.secretArn,
        AUTH_SERVICE_CLIENT_ID: this.configuration.authenticationServiceConfiguration?.clientId ?? '',
        AUTH_SERVICE_ENDPOINT: this.configuration.authenticationServiceConfiguration?.endpoint ?? '',

        // NL Wallet - VerId configuration
        USE_NL_WALLET_VERID: this.configuration.nlWalletVerIdIsLive ? 'true' : 'false',
        NL_WALLET_VERID_CLIENT_ID: StringParameter.valueForStringParameter(this, Statics.ssmVerIdClientId),
        NL_WALLET_VERID_CLIENT_SECRET_ARN: verIdClientSecret.secretArn,
        NL_WALLET_VERID_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmVerIdScope),
        NL_WALLET_VERID_WELL_KNOWN: StringParameter.valueForStringParameter(this, Statics.ssmVerIdWellKnown),

        // NL Wallet - Signicat configuration
        USE_NL_WALLET_SIGNICAT: this.configuration.nlWalletSignicatIsLive ? 'true' : 'false',
        NL_WALLET_SIGNICAT_CLIENT_ID: StringParameter.valueForStringParameter(this, Statics.ssmSignicatClientId),
        NL_WALLET_SIGNICAT_CLIENT_SECRET_ARN: signicatClientSecret.secretArn,
        NL_WALLET_SIGNICAT_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmSignicatScope),
        NL_WALLET_SIGNICAT_WELL_KNOWN: StringParameter.valueForStringParameter(this, Statics.ssmSignicatWellKnown),

        // Haal Centraal
        HAAL_CENTRAAL_LIVE: this.configuration.brpHaalCentraalIsLive ? 'true' : 'false',
        HAAL_CENTRAAL_CERT_SSM: haalCentraalConfig.clientCert.parameterName,
        HAAL_CENTRAAL_PRIVATE_KEY_ARN: haalCentraalConfig.privateKey.secretArn,
        HAAL_CENTRAAL_API_KEY_ARN: haalCentraalConfig.apiKey.secretArn,
        HAAL_CENTRAAL_BASE_URL: StringParameter.valueForStringParameter(this, Statics.ssmHaalCentraalBaseUrl),

      },
      apiFunction: AuthFunction,
    });
    haalCentraalConfig.apiKey.grantRead(authFunction.lambda);
    haalCentraalConfig.privateKey.grantRead(authFunction.lambda);
    haalCentraalConfig.clientCert.grantRead(authFunction.lambda);
    authServiceClientSecret.grantRead(authFunction.lambda);
    verIdClientSecret.grantRead(authFunction.lambda);
    signicatClientSecret.grantRead(authFunction.lambda);
    oidcSecret.grantRead(authFunction.lambda);
    mtlsConfig.privateKey.grantRead(authFunction.lambda);
    mtlsConfig.clientCert.grantRead(authFunction.lambda);
    mtlsConfig.rootCert.grantRead(authFunction.lambda);

    return authFunction;
  }

  private persoonsgegevensFunction(mtlsConfig: TLSConfig, haalCentraalConfig: HaalCentraalConfig) {

    const persoonsGegevensFunction = new ApiFunction(this, 'persoonsgegevens-function', {
      description: 'Authenticatie-lambda voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/persoonsgegevens',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      environment: {
        MTLS_PRIVATE_KEY_ARN: mtlsConfig.privateKey.secretArn,
        MTLS_CLIENT_CERT_NAME: mtlsConfig.clientCert.parameterName,
        MTLS_ROOT_CA_NAME: mtlsConfig.rootCert.parameterName,
        BRP_API_URL: StringParameter.valueForStringParameter(this, Statics.ssmBrpApiEndpointUrl),
        HAALCENTRAAL_LIVE: this.configuration.brpHaalCentraalIsLive ? 'true' : 'false',
        SHOW_CONTACTGEGEVENS: this.configuration.mijnContactGegevensLive ? 'True' : 'False',

        // Haal Centraal
        HAAL_CENTRAAL_LIVE: this.configuration.brpHaalCentraalIsLive ? 'true' : 'false',
        HAAL_CENTRAAL_CERT_SSM: haalCentraalConfig.clientCert.parameterName,
        HAAL_CENTRAAL_PRIVATE_KEY_ARN: haalCentraalConfig.privateKey.secretArn,
        HAAL_CENTRAAL_API_KEY_ARN: haalCentraalConfig.apiKey.secretArn,
        HAAL_CENTRAAL_BASE_URL: StringParameter.valueForStringParameter(this, Statics.ssmHaalCentraalBaseUrl),

      },
      apiFunction: PersoonsgegevensFunction,
    });

    haalCentraalConfig.apiKey.grantRead(persoonsGegevensFunction.lambda);
    haalCentraalConfig.privateKey.grantRead(persoonsGegevensFunction.lambda);
    haalCentraalConfig.clientCert.grantRead(persoonsGegevensFunction.lambda);
    mtlsConfig.privateKey.grantRead(persoonsGegevensFunction.lambda);
    mtlsConfig.clientCert.grantRead(persoonsGegevensFunction.lambda);
    mtlsConfig.rootCert.grantRead(persoonsGegevensFunction.lambda);
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
        BRP_API_URL: StringParameter.valueForStringParameter(this, Statics.ssmBrpApiEndpointUrl),
        UITKERING_API_URL: StringParameter.valueForStringParameter(this, Statics.ssmUitkeringsApiEndpointUrl),
        SHOW_CONTACTGEGEVENS: this.configuration.mijnContactGegevensLive ? 'True' : 'False',
      },
      apiFunction: UitkeringFunction,
    });
    mtlsConfig.privateKey.grantRead(uitkeringenFunction.lambda);
    mtlsConfig.clientCert.grantRead(uitkeringenFunction.lambda);
    mtlsConfig.rootCert.grantRead(uitkeringenFunction.lambda);
    return uitkeringenFunction;
  }

  private contactgegevensFunction() {
    const openklantApiKey = Secret.fromSecretNameV2(this, 'openklant-token', Statics.ssmOpenKlantSecret);
    const notifyApiKey = Secret.fromSecretNameV2(this, 'notfiy-apikey', Statics.ssmNotifySecret);

    const contactgegevensFunctie = new ApiFunction(this, 'contactgegevens-function', {
      description: 'Contactgegevens uit openklant voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/contactgegevens',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      environment: {
        OPENKLANT_API_ENDPOINT: StringParameter.valueForStringParameter(this, Statics.ssmOpenKlantEndpoint),
        OPENKLANT_API_KEY_ARN: openklantApiKey.secretArn,
        SHOW_CONTACTGEGEVENS: this.configuration.mijnContactGegevensLive ? 'True' : 'False',
        POWERTOOLS_LOG_LEVEL: this.configuration.logLevel ?? 'INFO',
        NOTIFY_API_KEY_ARN: notifyApiKey.secretArn,
      },
      apiFunction: ContactgegevensFunction,
    });
    openklantApiKey.grantRead(contactgegevensFunctie.lambda);
    return contactgegevensFunctie;
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
        SHOW_CONTACTGEGEVENS: this.configuration.mijnContactGegevensLive ? 'True' : 'False',
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
        SHOW_CONTACTGEGEVENS: this.configuration.mijnContactGegevensLive ? 'True' : 'False',
      },
    });

    if (this.configuration.useZakenFromAggregatorAPI) {
      this.grantZakenApiAccess(takenFunction);
    }
    return takenFunction;
  }


  private productenFunction() {
    //TODO open producten secrets
    const productenFunction = new ApiFunction(this, 'producten-function', {
      description: 'Producten lambda om producten op te halen en tonen',
      codePath: 'app/producten',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: this.baseUrl,
      environment: {},
      apiFunction: ProductenFunction,
    });
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
