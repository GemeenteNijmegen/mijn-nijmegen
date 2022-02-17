import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { aws_secretsmanager, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiFunction } from './ApiFunction';
import { SessionsTable } from './SessionsTable';
import { Statics } from './statics';

export interface ApiStackProps extends StackProps {
  sessionsTable: SessionsTable;
}

/**
 * The API Stack creates both the API Gateway and the related
 * lambda's. It requires supporting resources (such as the
 * DynamoDB sessions table to be provided and thus created first)
 */
export class ApiStack extends Stack {
  apiGatewayDomain: string;
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id);
    const api = new apigatewayv2.HttpApi(this, 'mijnuitkering-api', {
      description: 'Mijn Uitkering webapplicatie',
    });
    const apiHost = this.cleanDomain(api.url);
    this.apiGatewayDomain = apiHost;
    const loginFunction = new ApiFunction(this, 'login-function', {
      description: 'Login-pagina voor de Mijn Uitkering-applicatie.',
      codePath: 'app/login',
      table: props.sessionsTable.table,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: api.url,
    });

    const oidcSecret = aws_secretsmanager.Secret.fromSecretNameV2(this, 'oidc-secret', Statics.secretOIDCClientSecret);
    const authFunction = new ApiFunction(this, 'auth-function', {
      description: 'Authenticatie-lambd voor de Mijn Uitkering-applicatie.',
      codePath: 'app/auth',
      table: props.sessionsTable.table,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: api.url,
      environment: {
        CLIENT_SECRET_ARN: oidcSecret.secretArn,
      },
    });
    oidcSecret.grantRead(authFunction.lambda);

    const homeFunction = new ApiFunction(this, 'home-function', {
      description: 'Home-lambda voor de Mijn Uitkering-applicatie.',
      codePath: 'app/home',
      table: props.sessionsTable.table,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: api.url,
    });

    api.addRoutes({
      integration: new HttpLambdaIntegration('login', loginFunction.lambda),
      path: '/login',
      methods: [apigatewayv2.HttpMethod.GET],
    });

    api.addRoutes({
      integration: new HttpLambdaIntegration('auth', authFunction.lambda),
      path: '/auth',
      methods: [apigatewayv2.HttpMethod.GET],
    });

    api.addRoutes({
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