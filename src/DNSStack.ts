import { aws_route53, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DNSStackProps extends StackProps {
  stage: String;
}

export class DNSStack extends Stack {
  constructor(scope: Construct, id: string, props: DNSStackProps) {
    super(scope, id);
    new aws_route53.HostedZone(this, 'mijnuitkering-csp', {
      zoneName: `mijnuitkering-${props.stage}.csp-nijmegen.nl`,
    });
  }
}
