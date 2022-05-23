import { Stack, aws_ssm as SSM, StackProps, aws_kms as KMS } from 'aws-cdk-lib';
import { Construct } from 'constructs';
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
  }
}