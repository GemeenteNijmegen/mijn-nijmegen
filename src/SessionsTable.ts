import { aws_dynamodb as DynamoDB, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class SessionsTable extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    new DynamoDB.Table(this, 'sessions-table', {
      partitionKey: { name: 'sessionid', type: DynamoDB.AttributeType.STRING },
      billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
      tableName: 'mijnuitkering-sessions',
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
