import * as path from 'path';
import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { Stack, aws_lambda } from 'aws-cdk-lib';
import { Construct } from 'constructs';


export class ApiStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    const api = new apigatewayv2.HttpApi(this, 'httpApi');

    const loginLambda = new aws_lambda.Function(this, 'login', {
      runtime: aws_lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      code: aws_lambda.Code.fromAsset(path.join(__dirname, 'app/login')),
    });

    api.addRoutes({
      integration: new HttpLambdaIntegration('login', loginLambda),
      path: '/login',
      methods: [apigatewayv2.HttpMethod.GET],
    });
  }
}
