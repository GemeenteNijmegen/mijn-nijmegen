import { aws_route53 as Route53, Stack, StackProps, aws_ssm as SSM } from 'aws-cdk-lib';
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
    this.setDNSSEC(props);
  }

  setDNSSEC(props: DNSSECStackProps) {

    const parameters = new RemoteParameters(this, 'params', {
      path: `${Statics.ssmZonePath}/`,
      region: 'eu-west-1',
    });
    const zoneId = parameters.get(Statics.ssmZoneIdNew);

    const dnssec = new Route53.CfnDNSSEC(this, 'dnssec', {
      hostedZoneId: zoneId,
    });

    /**
     * New ksk in prod only
     */
    if (props.branch === 'production') {
      // Production KSK
      const accountKmsKeyArnForDnsSec = SSM.StringParameter.valueForStringParameter(this, Statics.ssmAccountDnsSecKmsKey);
      const dnssecKeySigningNew = new Route53.CfnKeySigningKey(this, 'dnssec-keysigning-key', {
        name: 'mijn_nijmegen_key_signing_key',
        status: 'ACTIVE',
        hostedZoneId: zoneId,
        keyManagementServiceArn: accountKmsKeyArnForDnsSec,
      });
      dnssec.node.addDependency(dnssecKeySigningNew);
    } else {
      // Acceptance KSK
      const accountDnssecKmsKeyArn = SSM.StringParameter.valueForStringParameter(this, Statics.ssmAccountDnsSecKmsKey);
      const dnssecKeySigning = new Route53.CfnKeySigningKey(this, 'dnssec-keysigning-key-2', {
        name: 'mijn_nijmegen_ksk',
        status: 'ACTIVE',
        hostedZoneId: zoneId,
        keyManagementServiceArn: accountDnssecKmsKeyArn,
      });
      dnssec.node.addDependency(dnssecKeySigning);
    }


  }

}