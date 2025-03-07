import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';

interface MainStackProps extends StackProps, Configurable { }

export class MainStack extends Stack {
  constructor(scope: Construct, id: string, private readonly props: MainStackProps) {
    super(scope, id, props);

    // TODO add resources here

  }
}