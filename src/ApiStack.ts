import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { aws_secretsmanager, Stack, StackProps } from 'aws-cdk-lib';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { AccountPrincipal, PrincipalWithConditions, Role } from 'aws-cdk-lib/aws-iam';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { IStringParameter, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ApiFunction } from './ApiFunction';
import { AuthFunction } from './app/auth/auth-function';
import { HomeFunction } from './app/home/home-function';
import { LoginFunction } from './app/login/login-function';
import { LogoutFunction } from './app/logout/logout-function';
import { PersoonsgegevensFunction } from './app/persoonsgegevens/persoonsgegevens-function';
import { UitkeringFunction } from './app/uitkeringen/uitkering-function';
import { DynamoDbReadOnlyPolicy } from './iam/dynamodb-readonly-policy';
import { SessionsTable } from './SessionsTable';
import { Statics } from './statics';

interface TLSConfig {
  privateKey: ISecret;
  clientCert: IStringParameter;
  rootCert: IStringParameter;
}

export interface ApiStackProps extends StackProps {
  sessionsTable: SessionsTable;
  branch: string;
  // zone: HostedZone;
}

/**
 * The API Stack creates the API Gateway and related
 * lambda's. It requires supporting resources (such as the
 * DynamoDB sessions table to be provided and thus created first)
 */
export class ApiStack extends Stack {
  private sessionsTable: Table;
  api: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id);
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
    this.setFunctions(`https://${appDomain}/`, readOnlyRole);
    this.allowReadAccessToTable(readOnlyRole, this.sessionsTable);
  }

  /**
   * Create and configure lambda's for all api routes, and
   * add routes to the gateway.
   * @param {string} baseUrl the application url
   */
  setFunctions(baseUrl: string, readOnlyRole: Role) {


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
      description: 'Uitlog-pagina voor de Mijn Uitkering-applicatie.',
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
      description: 'Login-pagina voor de Mijn Uitkering-applicatie.',
      codePath: 'app/login',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
      readOnlyRole,
      apiFunction: LoginFunction,
      environment: {
        DIGID_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmDIGIDScope),
        YIVI_SCOPE: StringParameter.valueForStringParameter(this, Statics.ssmYiviScope),
        YIVI_ATTRIBUTES: StringParameter.valueForStringParameter(this, Statics.ssmYiviAttributes),
        USE_YIVI: StringParameter.valueForStringParameter(this, Statics.ssmUseYivi),
      },
    });
  }

  private homeFunction(baseUrl: string, readOnlyRole: Role) {
    return new ApiFunction(this, 'home-function', {
      description: 'Home-lambda voor de Mijn Uitkering-applicatie.',
      codePath: 'app/home',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
      readOnlyRole,
      apiFunction: HomeFunction,
    });
  }

  private authFunction(baseUrl: string, readOnlyRole: Role, mtlsConfig: TLSConfig) {
    const oidcSecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'oidc-secret', Statics.secretOIDCClientSecret);

    const authFunction = new ApiFunction(this, 'auth-function', {
      description: 'Authenticatie-lambd voor de Mijn Uitkering-applicatie.',
      codePath: 'app/auth',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
      readOnlyRole,
      environment: {
        CLIENT_SECRET_ARN: oidcSecret.secretArn,
        MTLS_PRIVATE_KEY_ARN: mtlsConfig.privateKey.secretArn,
        MTLS_CLIENT_CERT_NAME: Statics.ssmMTLSClientCert,
        MTLS_ROOT_CA_NAME: Statics.ssmMTLSRootCA,
        BRP_API_URL: StringParameter.valueForStringParameter(this, Statics.ssmBrpApiEndpointUrl),
        YIVI_ATTRIBUTES: StringParameter.valueForStringParameter(this, Statics.ssmYiviAttributes),
        USE_YIVI: StringParameter.valueForStringParameter(this, Statics.ssmUseYivi),
      },
      apiFunction: AuthFunction,
    });
    oidcSecret.grantRead(authFunction.lambda);
    mtlsConfig.privateKey.grantRead(authFunction.lambda);
    mtlsConfig.clientCert.grantRead(authFunction.lambda);
    mtlsConfig.rootCert.grantRead(authFunction.lambda);
    return authFunction;
  }

  private persoonsgegevensFunction(baseUrl: string, readOnlyRole: Role, mtlsConfig: TLSConfig) {

    const persoonsGegevensFunction = new ApiFunction(this, 'persoonsgegevens-function', {
      description: 'Authenticatie-lambd voor de Mijn Uitkering-applicatie.',
      codePath: 'app/persoonsgegevens',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
      readOnlyRole,
      environment: {
        MTLS_PRIVATE_KEY_ARN: mtlsConfig.privateKey.secretArn,
        MTLS_CLIENT_CERT_NAME: Statics.ssmMTLSClientCert,
        MTLS_ROOT_CA_NAME: Statics.ssmMTLSRootCA,
        BRP_API_URL: StringParameter.valueForStringParameter(this, Statics.ssmBrpApiEndpointUrl),
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
        MTLS_CLIENT_CERT_NAME: Statics.ssmMTLSClientCert,
        MTLS_ROOT_CA_NAME: Statics.ssmMTLSRootCA,
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
