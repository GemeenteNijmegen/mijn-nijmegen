import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiFunction } from './ApiFunction';
import { SessionsTable } from './SessionsTable';

export interface ApiStackProps extends StackProps {
  sessionsTable: SessionsTable;
}

/**
 * The API Stack creates both the API Gateway and the related
 * lambda's. It requires supporting resources (such as the
 * DynamoDB sessions table to be provided and thus created first)
 */
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id);
    const api = new apigatewayv2.HttpApi(this, 'mijnuitkering-api', {
      description: 'Mijn Uitkering webapplicatie',
    });

    const loginFunction = new ApiFunction(this, 'login-function', {
      description: 'Login-pagina voor de Mijn Uitkering-applicatie.',
      codePath: 'app/login',
      table: props.sessionsTable.table,
      tablePermissions: 'ReadWrite',
      applicationUrlBase: api.url,
    });

    api.addRoutes({
      integration: new HttpLambdaIntegration('login', loginFunction.lambda),
      path: '/login',
      methods: [apigatewayv2.HttpMethod.GET],
    });
  }
}