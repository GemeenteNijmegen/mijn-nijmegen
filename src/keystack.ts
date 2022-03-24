import { aws_kms as KMS, Stack, aws_iam as IAM, aws_ssm as SSM } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './statics';

/**
 * For session storage a sessions-table is created in dynamoDB. Session
 * state is maintained by relating an opaque session cookie value to this table.
 */
export class KeyStack extends Stack {
  /**
     * key for encrypting user data
     */
  key: KMS.Key;

  /**
     * key for encrypting logging data
     */
  // logKey: KMS.Key;
  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.key = new KMS.Key(this, 'kmskey', {
      enableKeyRotation: true,
      description: 'encryption key for Mijn Nijmegen',
      alias: 'mijnnijmegen/userdata',
    });

    // Store key arn to be used in other stacks/projects
    new SSM.StringParameter(this, 'ssm_sessions_1', {
      stringValue: this.key.keyArn,
      parameterName: Statics.ssmDataKeyArn,
    });

    // this.logKey = new KMS.Key(this, 'logkey', {
    //     enableKeyRotation: true,
    //     description: 'encryption key for Mijn Nijmegen logging',
    //     alias: 'mijnnijmegen/logs'
    // });
  }

  setPolicies() {
    this.key.addToResourcePolicy(new IAM.PolicyStatement({
      sid: 'Allow direct access to key metadata to the account',
      effect: IAM.Effect.ALLOW,
      principals: [new IAM.AccountRootPrincipal],
      actions: [
        'kms:Describe*',
        'kms:Get*',
        'kms:List*',
        'kms:RevokeGrant',
      ],
      resources: ['*'],
    }));

    this.key.addToResourcePolicy(new IAM.PolicyStatement({
      sid: 'Allow DynamoDB to directly describe the key',
      effect: IAM.Effect.ALLOW,
      principals: [new IAM.ServicePrincipal('dynamodb.amazonaws.com')],
      actions: [
        'kms:Describe*',
        'kms:Get*',
        'kms:List*',
      ],
      resources: ['*'], // Wildcard '*' required
    }));
  }
}