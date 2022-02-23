import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { aws_secretsmanager, Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Distribution, OriginRequestPolicy, PriceClass, ViewerProtocolPolicy, ResponseHeadersPolicy, HeadersFrameOption, HeadersReferrerPolicy, AllowedMethods } from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Bucket, BlockPublicAccess, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
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
   * @param {string} apiGatewayDomain the domain the api gateway can be reached at
   * @returns {string} the base url for the cloudfront distribution
   */
  setCloudfrontStack(apiGatewayDomain: string): string {

    const distribution = new Distribution(this, 'cf-distribution', {
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: new HttpOrigin(apiGatewayDomain),
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_ALL,
      },
      logBucket: this.logBucket()
    });

    return `https://${distribution.distributionDomainName}/`;
  }

  logBucket() {
    /**
     * bucket voor cloudfront logs
     */
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

    const homeFunction = new ApiFunction(this, 'home-function', {
      description: 'Home-lambda voor de Mijn Uitkering-applicatie.',
      codePath: 'app/home',
      table: this.sessionsTable,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: baseUrl,
    });

    this.api.addRoutes({
      integration: new HttpLambdaIntegration('login', loginFunction.lambda),
      path: '/login',
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