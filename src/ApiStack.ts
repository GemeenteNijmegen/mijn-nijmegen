import * as path from 'path';
import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { LambdaToDynamoDB, LambdaToDynamoDBProps } from '@aws-solutions-constructs/aws-lambda-dynamodb';
import { Stack, aws_lambda, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SessionsTable } from './SessionsTable';

export interface ApiStackProps extends StackProps {
  sessionsTable: SessionsTable;
}

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id);
    const api = new apigatewayv2.HttpApi(this, 'mijnuitkering-api', {
      description: 'Mijn Uitkering webapplicatie',
    });

    const loginLambda = new aws_lambda.Function(this, 'login', {
      runtime: aws_lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      description: 'Login-pagina voor de Mijn Uitkering-applicatie.',
      code: aws_lambda.Code.fromAsset(path.join(__dirname, 'app/login')),
    });

    const lambdaProps: LambdaToDynamoDBProps = {
      existingLambdaObj: loginLambda,
      existingTableObj: props.sessionsTable.table,
      tablePermissions: 'Read',
      tableEnvironmentVariableName: 'SESSION_TABLE',
    };

    new LambdaToDynamoDB(this, 'login-lambda-with-db', lambdaProps);

    api.addRoutes({
      integration: new HttpLambdaIntegration('login', loginLambda),
      path: '/login',
      methods: [apigatewayv2.HttpMethod.GET],
    });
  }
}
