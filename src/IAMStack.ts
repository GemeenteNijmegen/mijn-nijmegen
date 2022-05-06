import { aws_iam, aws_ssm, Stack } from 'aws-cdk-lib';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { Statics } from './statics';

export class IAMStack extends Stack {

  constructor(scope: Construct, id: string) {
    super(scope, id);
    const accountId = aws_ssm.StringParameter.fromStringParameterName(this, 'iamaccount', Statics.iamAccountId);
    const readOnlyRole = new Role(this, 'read-only-role', {
      roleName: 'mijnnijmegen-full-read',
      description: 'Read-only role for Mijn Nijmegen with access to lambdas, logging, session store',
      assumedBy: new aws_iam.AccountPrincipal(accountId),
    });
    new aws_ssm.StringParameter(this, 'ssm_readonly_role', {
      stringValue: readOnlyRole.roleArn,
      parameterName: Statics.ssmReadOnlyRoleArn,
    });
  }
}