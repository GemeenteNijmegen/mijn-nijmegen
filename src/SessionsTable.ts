import { aws_dynamodb as DynamoDB, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './statics';

export class SessionsTable extends Construct {
  table: DynamoDB.Table;
  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.table = new DynamoDB.Table(this, 'sessions-table', {
      partitionKey: { name: 'sessionid', type: DynamoDB.AttributeType.STRING },
      billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
      tableName: Statics.sessionTableName,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.RETAIN,
    });


  }
}