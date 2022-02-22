import { aws_route53, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

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
    new aws_route53.HostedZone(this, 'mijnuitkering-csp', {
      zoneName: `${subdomain}.csp-nijmegen.nl`,
    });
  }
}
