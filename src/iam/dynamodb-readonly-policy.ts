import { Effect, ManagedPolicy, PolicyProps, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface DynamoDbReadOnlyPolicyProps extends PolicyProps {
  tableArn: string;
}

export class DynamoDbReadOnlyPolicy extends ManagedPolicy {
  /**
     * Read only access to DynamoDB table. Deliberatly excludes
     * access to the KMS key used.
     */
  constructor(scope: Construct, id: string, props: DynamoDbReadOnlyPolicyProps) {
    super(scope, id, props);

    this.addStatements(new PolicyStatement(
      {
        effect: Effect.ALLOW,
        actions: [
          'dynamodb:BatchGetItem',
          'dynamodb:Describe*',
          'dynamodb:List*',
          'dynamodb:GetItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        resources: [props.tableArn],
      },
    ));
  }
}