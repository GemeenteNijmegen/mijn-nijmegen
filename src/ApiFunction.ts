import * as path from 'path';
import { LambdaToDynamoDB, LambdaToDynamoDBProps } from '@aws-solutions-constructs/aws-lambda-dynamodb';
import { aws_lambda, aws_dynamodb } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface ApiFunctionProps {
  description: string;
  codePath: string;
  table: aws_dynamodb.Table;
  tablePermissions: string;
}

export class ApiFunction extends Construct {
  lambda: aws_lambda.Function;
  constructor(scope: Construct, id: string, props: ApiFunctionProps) {
    super(scope, id);
    this.lambda = new aws_lambda.Function(this, 'lambda', {
      runtime: aws_lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      description: props.description,
      code: aws_lambda.Code.fromAsset(path.join(__dirname, props.codePath)),
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
