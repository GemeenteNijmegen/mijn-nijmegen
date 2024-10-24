import { aws_secretsmanager, Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { AccountPrincipal, PrincipalWithConditions, Role } from 'aws-cdk-lib/aws-iam';
import { ISecret, Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { IStringParameter, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ApiFunction } from './ApiFunction';
import { AuthFunction } from './app/auth/auth-function';
import { HomeFunction } from './app/home/home-function';
import { LoginFunction } from './app/login/login-function';
import { LogoutFunction } from './app/logout/logout-function';
import { PersoonsgegevensFunction } from './app/persoonsgegevens/persoonsgegevens-function';
import { UitkeringFunction } from './app/uitkeringen/uitkering-function';
import { ZakenFunction } from './app/zaken/zaken-function';
import { Configurable, Configuration } from './Configuration';
import { DynamoDbReadOnlyPolicy } from './iam/dynamodb-readonly-policy';
import { SessionsTable } from './SessionsTable';
import { Statics } from './statics';

interface TLSConfig {
  privateKey: ISecret;
  clientCert: IStringParameter;
  rootCert: IStringParameter;
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
    const appDomain = `${subdomain}.nijmegen.nl`;

    const readOnlyRole = this.readOnlyRole();

    this.setFunctions(`https://${appDomain}/`, readOnlyRole, props.configuration);
    this.allowReadAccessToTable(readOnlyRole, this.sessionsTable);
  }

  /**
   * Create and configure lambda's for all api routes, and
   * add routes to the gateway.
   * @param {string} baseUrl the application url
   */
  setFunctions(baseUrl: string, readOnlyRole: Role, configuration: Configuration) {
    const tlsConfig = this.mtlsConfig();
    /**
     * The login function generates a login URL and renders the login page.
     */
    const loginFunction = this.loginFunction(baseUrl, readOnlyRole);

    /**
     * The logout-function sets logout, unsets the session object and renders the logged-out page.
     */
    const logoutFunction = this.logoutFunction(baseUrl, readOnlyRole);

    /**
     * The auth function receives the callback from the OIDC-provider, validates the received ID-Token, and sets the session to loggedin.
     */
    const authFunction = this.authFunction(baseUrl, readOnlyRole, tlsConfig);

    /**
     * The Home function show the homepage.
     */
    const homeFunction = this.homeFunction(baseUrl, readOnlyRole);

    /**
     * The Persoonsgegevens function show the homepage.
     */
    const persoonsGegevensFunction = this.persoonsgegevensFunction(baseUrl, readOnlyRole, tlsConfig);

    /**
     * The uitkeringenfunction show your current uitkering.
     */
    const uitkeringenFunction = this.uitkeringenFunction(baseUrl, readOnlyRole, tlsConfig);

    /**
     * The zaken function show your current zaken.
     */
    const zakenFunction = this.zakenFunction(baseUrl, readOnlyRole);


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

    if (configuration.inzageLive) {
      const inzageFunction = this.inzageFunction(baseUrl, readOnlyRole, tlsConfig);
      this.api.addRoutes({
        integration: new HttpLambdaIntegration('inzage', inzageFunction.lambda),
        path: '/inzage',
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

  private logoutFunction(baseUrl: string, readOnlyRole: Role) {
    return new ApiFunction(this, 'logout-function', {
      description: 'Uitlog-pagina voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/logout',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
      readOnlyRole,
      apiFunction: LogoutFunction,
    });
  }

  private loginFunction(baseUrl: string, readOnlyRole: Role) {
    return new ApiFunction(this, 'login-function', {
      description: 'Login-pagina voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/login',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
      readOnlyRole,
      apiFunction: LoginFunction,
      environment: {
        DIGID_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmDIGIDScope),
        YIVI_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmYiviScope),
        EHERKENNING_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmEherkenningScope),
        YIVI_BSN_ATTRIBUTE: StringParameter.valueForStringParameter(this, Statics.ssmYiviBsnAttribute),
        YIVI_CONDISCON_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmYiviCondisconScope),
        USE_YIVI_KVK: StringParameter.valueForStringParameter(this, Statics.ssmUseYiviKvk), // Feature flag for kvk bsn conditional disclosure
      },
    });
  }

  private homeFunction(baseUrl: string, readOnlyRole: Role) {
    const homeFunction = new ApiFunction(this, 'home-function', {
      description: 'Home-lambda voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/home',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
      readOnlyRole,
      apiFunction: HomeFunction,
      functionProps: {
        timeout: Duration.seconds(15), // frontend async calls can take a while
        memorySize: 1024,
      },
    });

    if (this.configuration.useZakenFromAggregatorAPI) {
      this.grantZakenApiAccess(homeFunction);
    }
    return homeFunction;
  }

  private authFunction(baseUrl: string, readOnlyRole: Role, mtlsConfig: TLSConfig) {
    const oidcSecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'oidc-secret', Statics.secretOIDCClientSecret);
    const authServiceClientSecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'auth-serice-client-secret', Statics.authServiceClientSecretArn);
    const brpHaalCentraalApiKeySecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'brp-haal-centraal-api-key-auth-secret', Statics.haalCentraalApiKeySecret);

    const authFunction = new ApiFunction(this, 'auth-function', {
      description: 'Authenticatie-lambda voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/auth',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
      readOnlyRole,
      timeout: Duration.seconds(6), // Too long but required for poc authentication service
      environment: {
        CLIENT_SECRET_ARN: oidcSecret.secretArn,
        MTLS_PRIVATE_KEY_ARN: mtlsConfig.privateKey.secretArn,
        MTLS_CLIENT_CERT_NAME: mtlsConfig.clientCert.parameterName,
        MTLS_ROOT_CA_NAME: mtlsConfig.rootCert.parameterName,
        BRP_API_URL: StringParameter.valueForStringParameter(this, Statics.ssmBrpApiEndpointUrl),
        BRP_HAAL_CENTRAAL_API_URL: StringParameter.valueForStringParameter(this, Statics.ssmBrpHaalCentraalApiEndpointUrl),
        BRP_API_KEY: brpHaalCentraalApiKeySecret.secretArn,
        HAALCENTRAAL_LIVE: this.configuration.brpHaalCentraalIsLive ? 'true' : 'false',
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
      },
      apiFunction: AuthFunction,
    });
    brpHaalCentraalApiKeySecret.grantRead(authFunction.lambda);
    authServiceClientSecret.grantRead(authFunction.lambda);
    oidcSecret.grantRead(authFunction.lambda);
    mtlsConfig.privateKey.grantRead(authFunction.lambda);
    mtlsConfig.clientCert.grantRead(authFunction.lambda);
    mtlsConfig.rootCert.grantRead(authFunction.lambda);

    return authFunction;
  }

  private persoonsgegevensFunction(baseUrl: string, readOnlyRole: Role, mtlsConfig: TLSConfig) {

    const persoonsGegevensFunction = new ApiFunction(this, 'persoonsgegevens-function', {
      description: 'Authenticatie-lambda voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/persoonsgegevens',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
      readOnlyRole,
      environment: {
        MTLS_PRIVATE_KEY_ARN: mtlsConfig.privateKey.secretArn,
        MTLS_CLIENT_CERT_NAME: mtlsConfig.clientCert.parameterName,
        MTLS_ROOT_CA_NAME: mtlsConfig.rootCert.parameterName,
        BRP_API_URL: StringParameter.valueForStringParameter(this, Statics.ssmBrpApiEndpointUrl),
        HAALCENTRAAL_LIVE: this.configuration.brpHaalCentraalIsLive ? 'true' : 'false',
      },
      apiFunction: PersoonsgegevensFunction,
    });
    mtlsConfig.privateKey.grantRead(persoonsGegevensFunction.lambda);
    mtlsConfig.clientCert.grantRead(persoonsGegevensFunction.lambda);
    mtlsConfig.rootCert.grantRead(persoonsGegevensFunction.lambda);
    return persoonsGegevensFunction;
  }

  private uitkeringenFunction(baseUrl: string, readOnlyRole: Role, mtlsConfig: TLSConfig) {
    const uitkeringenFunction = new ApiFunction(this, 'uitkeringen-function', {
      description: 'Uitkeringen-lambda voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/uitkeringen',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
      readOnlyRole,
      environment: {
        MTLS_PRIVATE_KEY_ARN: mtlsConfig.privateKey.secretArn,
        MTLS_CLIENT_CERT_NAME: mtlsConfig.clientCert.parameterName,
        MTLS_ROOT_CA_NAME: mtlsConfig.rootCert.parameterName,
        BRP_API_URL: StringParameter.valueForStringParameter(this, Statics.ssmBrpApiEndpointUrl),
        UITKERING_API_URL: StringParameter.valueForStringParameter(this, Statics.ssmUitkeringsApiEndpointUrl),
      },
      apiFunction: UitkeringFunction,
    });
    mtlsConfig.privateKey.grantRead(uitkeringenFunction.lambda);
    mtlsConfig.clientCert.grantRead(uitkeringenFunction.lambda);
    mtlsConfig.rootCert.grantRead(uitkeringenFunction.lambda);
    return uitkeringenFunction;
  }

  private inzageFunction(baseUrl: string, readOnlyRole: Role, mtlsConfig: TLSConfig) {
    const inzageApiKey = Secret.fromSecretNameV2(this, 'inzage-key', Statics.ssmInzageApiKey);

    const inzageFunction = new ApiFunction(this, 'inzage-function', {
      description: 'Inzage-lambda voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/inzage',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
      readOnlyRole,
      environment: {
        MTLS_PRIVATE_KEY_ARN: mtlsConfig.privateKey.secretArn,
        MTLS_CLIENT_CERT_NAME: mtlsConfig.clientCert.parameterName,
        MTLS_ROOT_CA_NAME: mtlsConfig.rootCert.parameterName,
        BRP_API_URL: StringParameter.valueForStringParameter(this, Statics.ssmBrpApiEndpointUrl),
        INZAGE_BASE_URL: StringParameter.valueForStringParameter(this, Statics.ssmInzageApiEndpointUrl),
        INZAGE_API_KEY_ARN: inzageApiKey.secretArn,
      },
      apiFunction: UitkeringFunction,
    });
    mtlsConfig.privateKey.grantRead(inzageFunction.lambda);
    mtlsConfig.clientCert.grantRead(inzageFunction.lambda);
    mtlsConfig.rootCert.grantRead(inzageFunction.lambda);
    return inzageFunction;
  }


  private zakenFunction(baseUrl: string, readOnlyRole: Role) {
    const jwtSecret = Secret.fromSecretNameV2(this, 'jwt-token-secret', Statics.vipJwtSecret);
    const tokenSecret = Secret.fromSecretNameV2(this, 'taken-token-secret', Statics.vipTakenSecret);
    const submissionstorageKey = Secret.fromSecretNameV2(this, 'taken-submission-secret', Statics.submissionstorageKey);
    const zakenFunction = new ApiFunction(this, 'zaken-function', {
      description: 'Zaken-lambda voor de Mijn Nijmegen-applicatie.',
      codePath: 'app/zaken',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
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
      },
      readOnlyRole,
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
  /**
   * Create a role with read-only access to the application
   *
   * @returns Role
   */
  readOnlyRole(): Role {
    const readOnlyRole = new Role(this, 'read-only-role', {
      roleName: 'mijnnijmegen-full-read',
      description: 'Read-only role for Mijn Nijmegen with access to lambdas, logging, session store',
      assumedBy: new PrincipalWithConditions(
        new AccountPrincipal(Statics.iamAccountId), //IAM account
        {
          Bool: {
            'aws:MultiFactorAuthPresent': true,
          },
        },
      ),
    });

    new StringParameter(this, 'ssm_readonly', {
      stringValue: readOnlyRole.roleArn,
      parameterName: Statics.ssmReadOnlyRoleArn,
    });
    return readOnlyRole;
  }

  allowReadAccessToTable(role: Role, table: Table) {
    role.addManagedPolicy(
      new DynamoDbReadOnlyPolicy(this, 'read-policy', {
        tableArn: table.tableArn,
      }),
    );
  }
}
