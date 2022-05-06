import { Stack, aws_ssm as SSM, StackProps, aws_kms as KMS } from 'aws-cdk-lib';
import { Role } from 'aws-cdk-lib/aws-iam';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { DynamoDbReadOnlyPolicy } from './iam/dynamodb-readonly-policy';
import { SessionsTable } from './SessionsTable';
import { Statics } from './statics';

export interface SessionStackProps extends StackProps {
  key: KMS.Key;
}

/**
 * For session storage a sessions-table is created in dynamoDB. Session
 * state is maintained by relating an opaque session cookie value to this table.
 */
export class SessionsStack extends Stack {
  sessionsTable : SessionsTable;

  constructor(scope: Construct, id: string, props: SessionStackProps) {
    super(scope, id);
    this.sessionsTable = new SessionsTable(this, 'sessions-table', { key: props.key });
    // Store session table id to be used in other stacks
    new SSM.StringParameter(this, 'ssm_sessions_1', {
      stringValue: this.sessionsTable.table.tableArn,
      parameterName: Statics.ssmSessionsTableArn,
    });

    this.allowAccessToReadOnlyRole();
  }

  private allowAccessToReadOnlyRole() {
    const roleArn = StringParameter.fromStringParameterName(this, 'readonly-role', Statics.ssmReadOnlyRoleArn);
    const role = Role.fromRoleArn(this, 'read-only-role', roleArn.stringValue);
    role.addManagedPolicy(
      new DynamoDbReadOnlyPolicy(this, 'read-policy', {
        tableArn: this.sessionsTable.table.tableArn,
      }),
    );
  }
}