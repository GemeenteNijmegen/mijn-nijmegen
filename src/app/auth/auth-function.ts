// ~~ Generated by projen. To modify, edit .projenrc.js and run "npx projen".
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * Props for AuthFunction
 */
export interface AuthFunctionProps extends lambda.FunctionOptions {
}

/**
 * An AWS Lambda function which executes src/app/auth/auth.
 */
export class AuthFunction extends lambda.Function {
  constructor(scope: Construct, id: string, props?: AuthFunctionProps) {
    super(scope, id, {
      description: 'src/app/auth/auth.lambda.ts',
      ...props,
      runtime: new lambda.Runtime('nodejs20.x', lambda.RuntimeFamily.NODEJS),
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../assets/app/auth/auth.lambda')),
    });
    this.addEnvironment('AWS_NODEJS_CONNECTION_REUSE_ENABLED', '1', { removeInEdge: true });
  }
}