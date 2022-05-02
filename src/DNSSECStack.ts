import { aws_route53 as Route53, Stack, StackProps, aws_kms as KMS, aws_iam as IAM, aws_ssm as SSM } from 'aws-cdk-lib';
import { RemoteParameters } from 'cdk-remote-stack';
import { Construct } from 'constructs';
import { Statics } from './statics';

export interface DNSSECStackProps extends StackProps {
  branch: string;
}

export class DNSSECStack extends Stack {
  /**
     * Add DNSSEC using a new KMS key to the domain.
     * The key needs to be created in us-east-1. It only adds
     * DNSSEC to the zone for this project. The parent zone needs
     * to have DNSSEC enabled as well.
     *
     * @param scope Construct
     * @param id stack id
     * @param props props object
     */
  constructor(scope: Construct, id: string, props: DNSSECStackProps) {
    super(scope, id, props);
    this.setDNSSEC();
  }

  setDNSSEC() {
    const key = this.addDNSSecKey(); // Keep the key (might be deleted if the imported key works later on)

    const parameters = new RemoteParameters(this, 'params', {
      path: `${Statics.ssmZonePath}/`,
      region: 'eu-west-1',
    });
    const zoneId = parameters.get(Statics.ssmZoneIdNew);

    const accountDnssecKmsKeyArn = SSM.StringParameter.valueForStringParameter(this, Statics.ssmAccountDnsSecKmsKey);

    const dnssecKeySigning = new Route53.CfnKeySigningKey(this, 'dnssec-keysigning-key', { // Keep the origional KSK for now
      name: 'dnssec_with_kms',
      status: 'ACTIVE',
      hostedZoneId: zoneId,
      keyManagementServiceArn: key.keyArn,
    });

    new Route53.CfnKeySigningKey(this, 'dnssec-keysigning-key-2', { // Create a new KSK using the imported KMS key
      name: 'mijn_nijmegen_ksk',
      status: 'ACTIVE',
      hostedZoneId: zoneId,
      keyManagementServiceArn: accountDnssecKmsKeyArn,
    });

    const dnssec = new Route53.CfnDNSSEC(this, 'dnssec', {
      hostedZoneId: zoneId,
    });
    dnssec.node.addDependency(dnssecKeySigning);

  }

  addDNSSecKey() {
    const dnssecKmsKey = new KMS.Key(this, 'dnssec-kms-key', {
      keySpec: KMS.KeySpec.ECC_NIST_P256,
      keyUsage: KMS.KeyUsage.SIGN_VERIFY,
      policy: new IAM.PolicyDocument({
        statements: [
          new IAM.PolicyStatement({
            actions: ['kms:Sign'],
            principals: [new IAM.AccountRootPrincipal()],
            resources: ['*'],
          }),
          new IAM.PolicyStatement({ //to fix 'The new key policy will not allow you to update the key policy in the future' in cloudformation
            actions: [
              'kms:Create*',
              'kms:Describe*',
              'kms:Enable*',
              'kms:List*',
              'kms:Put*',
              'kms:Update*',
              'kms:Revoke*',
              'kms:Disable*',
              'kms:Get*',
              'kms:Delete*',
              'kms:ScheduleKeyDeletion',
              'kms:CancelKeyDeletion',
              'kms:GenerateDataKey',
              'kms:TagResource',
              'kms:UntagResource',
            ],
            principals: [new IAM.AccountRootPrincipal()],
            resources: ['*'],
          }),
          new IAM.PolicyStatement({
            sid: 'Allow Route 53 DNSSEC to CreateGrant',
            actions: ['kms:CreateGrant'],
            principals: [new IAM.ServicePrincipal('dnssec-route53.amazonaws.com')],
            resources: ['*'],
            conditions: {
              Bool: {
                'kms:GrantIsForAWSResource': true,
              },
            },
          }),
          new IAM.PolicyStatement({
            sid: 'Allow Route 53 DNSSEC Service',
            actions: [
              'kms:DescribeKey',
              'kms:GetPublicKey',
              'kms:Sign',
            ],
            principals: [new IAM.ServicePrincipal('dnssec-route53.amazonaws.com')],
            resources: ['*'],
          }),
        ],
      }),
    });

    dnssecKmsKey.addAlias('mijnnijmegen/dnssec');
    return dnssecKmsKey;
  }
}