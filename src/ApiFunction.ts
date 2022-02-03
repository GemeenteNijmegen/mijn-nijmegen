import * as path from 'path';
import { LambdaToDynamoDB, LambdaToDynamoDBProps } from '@aws-solutions-constructs/aws-lambda-dynamodb';
import { aws_lambda as Lambda, aws_dynamodb, aws_ssm as SSM } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './statics';

export interface ApiFunctionProps {
  description: string;
  codePath: string;
  table: aws_dynamodb.Table;
  tablePermissions: string;
  applicationUrlBase?: string;
  environment?: {[key: string]: string};
}

export class ApiFunction extends Construct {
  lambda: Lambda.Function;
  constructor(scope: Construct, id: string, props: ApiFunctionProps) {
    super(scope, id);
    // See https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Lambda-Insights-extension-versionsx86-64.html
    const insightsArn = 'arn:aws:lambda:eu-west-1:580247275435:layer:LambdaInsightsExtension:16';
    this.lambda = new Lambda.Function(this, 'lambda', {
      runtime: Lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      description: props.description,
      code: Lambda.Code.fromAsset(path.join(__dirname, props.codePath)),
      insightsVersion: Lambda.LambdaInsightsVersion.fromInsightVersionArn(insightsArn),
      environment: {
        APPLICATION_URL_BASE: props.applicationUrlBase || '',
        AUTH_URL_BASE: SSM.StringParameter.valueForStringParameter(this, Statics.ssmAuthUrlBaseParameter),
        OIDC_CLIENT_ID: SSM.StringParameter.valueForStringParameter(this, Statics.ssmOIDCClientID),
        OIDC_SCOPE: SSM.StringParameter.valueForStringParameter(this, Statics.ssmOIDCScope),
        ...props.environment,
      },
    });

    const lambdaProps: LambdaToDynamoDBProps = {
      existingLambdaObj: this.lambda,
      existingTableObj: props.table,
      tablePermissions: props.tablePermissions,
      tableEnvironmentVariableName: 'SESSION_TABLE',
    };

    new LambdaToDynamoDB(this, 'lambda-with-db', lambdaProps);
  }
}
