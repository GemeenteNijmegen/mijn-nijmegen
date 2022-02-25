import { aws_route53 as Route53, Stack, StackProps, aws_ssm as SSM } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './statics';

export interface DNSStackProps extends StackProps {
  branch: string;
}

export class DNSStack extends Stack {
  constructor(scope: Construct, id: string, props: DNSStackProps) {
    super(scope, id);
    const subdomainMap = {
      acceptance: 'mijnuitkering-acc',
      production: 'mijnuitkering',
    };
    const subdomain = subdomainMap[props.branch as keyof typeof subdomainMap] ?? 'mijn-uitkering-dev';
    new Route53.HostedZone(this, 'mijnuitkering-csp', {
      zoneName: `${subdomain}.csp-nijmegen.nl`,
    });

    const rootZoneId = SSM.StringParameter.valueForStringParameter(this, Statics.cspRootZoneId);
    const cspRootZone = Route53.HostedZone.fromHostedZoneId(this, 'cspzone', rootZoneId);
    
    new Route53.TxtRecord(this, 'test-record', {
      zone: cspRootZone,
      recordName: 'tstjoost',
      values: ['ditiseentestvanjoost']
    });
  }
}
