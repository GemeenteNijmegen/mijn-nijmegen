import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { aws_secretsmanager, Stack, StackProps, Duration, aws_ssm as SSM } from 'aws-cdk-lib';
import { Distribution, PriceClass, OriginRequestPolicy, ViewerProtocolPolicy, AllowedMethods, ResponseHeadersPolicy, HeadersFrameOption, HeadersReferrerPolicy, CachePolicy, CacheCookieBehavior, CacheHeaderBehavior, CacheQueryStringBehavior, OriginRequestHeaderBehavior } from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket, BlockPublicAccess, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { ApiFunction } from './ApiFunction';
import { SessionsTable } from './SessionsTable';
import { Statics } from './statics';

export interface ApiStackProps extends StackProps {
  sessionsTable: SessionsTable;
}

/**
 * The API Stack creates the API Gateway and related
 * lambda's. It also creates a cloudfront distribution.
 * It requires supporting resources (such as the
 * DynamoDB sessions table to be provided and thus created first)
 */
export class ApiStack extends Stack {
  private api: apigatewayv2.HttpApi;
  private sessionsTable: Table;
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id);
    this.sessionsTable = props.sessionsTable.table;
    this.api = new apigatewayv2.HttpApi(this, 'mijnuitkering-api', {
      description: 'Mijn Uitkering webapplicatie',
    });
    const apiHost = this.cleanDomain(this.api.url);
    const cloudfrontUrl = this.setCloudfrontStack(apiHost);
    this.setFunctions(cloudfrontUrl);
  }

  /**
   * Create a cloudfront distribution for the application
   *
   * Do not forward the Host header to API Gateway. This results in
   * an HTTP 403 because API Gateway won't be able to find an endpoint
   * on the cloudfront domain.
   *
   * @param {string} apiGatewayDomain the domain the api gateway can be reached at
   * @returns {string} the base url for the cloudfront distribution
   */
  setCloudfrontStack(apiGatewayDomain: string): string {

    const distribution = new Distribution(this, 'cf-distribution', {
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: new HttpOrigin(apiGatewayDomain),
        originRequestPolicy: new OriginRequestPolicy(this, 'cf-originrequestpolicy', {
          originRequestPolicyName: 'cfOriginRequestPolicyMijnUitkering',
          headerBehavior: OriginRequestHeaderBehavior.allowList(
            'Accept-Charset',
            'Origin',
            'Accept',
            'Referer',
            'Accept-Language',
            'Accept-Datetime',
          ),
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        cachePolicy: new CachePolicy(this, 'cf-caching', {
          cachePolicyName: 'cfCachingSessionsMijnUitkering',
          cookieBehavior: CacheCookieBehavior.all(),
          headerBehavior: CacheHeaderBehavior.allowList('Authorization'),
          queryStringBehavior: CacheQueryStringBehavior.all(),
        }),
      },
      logBucket: this.logBucket(),
    });

    return `https://${distribution.distributionDomainName}/`;
  }
  /**
   * bucket voor cloudfront logs
   */
  logBucket() {
    const cfLogBucket = new Bucket(this, 'CloudfrontLogs', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          id: 'delete objects after 180 days',
          enabled: true,
          expiration: Duration.days(180),
        },
      ],
    });
    return cfLogBucket;
  }

  /**
   * Get a set of (security) response headers to inject into the response
   * @returns {ResponseHeadersPolicy} cloudfront responseHeadersPolicy
   */
  responseHeadersPolicy() {
    const cspValues = "default-src 'self';";
    const responseHeadersPolicy = new ResponseHeadersPolicy(this, 'headers', {
      securityHeadersBehavior: {
        contentSecurityPolicy: { contentSecurityPolicy: cspValues, override: true },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: HeadersReferrerPolicy.NO_REFERRER, override: true },
        strictTransportSecurity: { accessControlMaxAge: Duration.seconds(600), includeSubdomains: true, override: true },
        xssProtection: { protection: true, modeBlock: true, reportUri: 'https://example.com/csp-report', override: true },
      },
    });
    return responseHeadersPolicy;
  }

  /**
   * Create and configure lambda's for all api routes, and
   * add routes to the gateway.
   * @param {string} baseUrl the application url
   */
  setFunctions(baseUrl: string) {
    const loginFunction = new ApiFunction(this, 'login-function', {
      description: 'Login-pagina voor de Mijn Uitkering-applicatie.',
      codePath: 'app/login',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
    });

    const logoutFunction = new ApiFunction(this, 'logout-function', {
      description: 'Uitlog-pagina voor de Mijn Uitkering-applicatie.',
      codePath: 'app/logout',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
    });

    const oidcSecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'oidc-secret', Statics.secretOIDCClientSecret);
    const authFunction = new ApiFunction(this, 'auth-function', {
      description: 'Authenticatie-lambd voor de Mijn Uitkering-applicatie.',
      codePath: 'app/auth',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
      environment: {
        CLIENT_SECRET_ARN: oidcSecret.secretArn,
      },
    });
    oidcSecret.grantRead(authFunction.lambda);

    const secretMTLSPrivateKey = aws_secretsmanager.Secret.fromSecretNameV2(this, 'tls-key-secret', Statics.secretMTLSPrivateKey);
    const homeFunction = new ApiFunction(this, 'home-function', {
      description: 'Home-lambda voor de Mijn Uitkering-applicatie.',
      codePath: 'app/home',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
      environment: {
        MTLS_PRIVATE_KEY_ARN: secretMTLSPrivateKey.secretArn,
        MTLS_CLIENT_CERT_NAME: Statics.ssmMTLSClientCert,
        MTLS_ROOT_CA_NAME: Statics.ssmMTLSRootCA,
        UITKERING_API_URL: SSM.StringParameter.valueForStringParameter(this, Statics.ssmUitkeringsApiEndpointUrl),
      },
    });
    secretMTLSPrivateKey.grantRead(homeFunction.lambda);
    SSM.StringParameter.fromStringParameterName(this, 'tlskey', Statics.ssmMTLSClientCert).grantRead(homeFunction.lambda);
    SSM.StringParameter.fromStringParameterName(this, 'tlsrootca', Statics.ssmMTLSRootCA).grantRead(homeFunction.lambda);

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

    this.api.addRoutes({
      integration: new HttpLambdaIntegration('home', homeFunction.lambda),
      path: '/',
      methods: [apigatewayv2.HttpMethod.GET],
    });
  }

  /**
   * Clean a url placeholder. apigateway returns a url like
   * https://${Token[TOKEN.246]}.execute-api.eu-west-1.${Token[AWS.URLSuffix.3]}/
   * which can't be parsed by the URL class.
   *
   * @param url a url-like string optionally containing protocol and trailing slash
   * @returns a url-like string cleaned of protocol and trailing slash
   */
  cleanDomain(url?: string): string {
    if (!url) { return ''; }
    let cleanedUrl = url
      .replace(/^https?:\/\//, '') //protocol
      .replace(/\/$/, ''); //optional trailing slash
    return cleanedUrl;
  }
}