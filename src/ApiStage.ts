import { Stage } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStack } from './ApiStack';


export class ApiStage extends Stage {
  constructor(scope: Construct, id: string, props: {}) {
    super(scope, id, props);
    new ApiStack(this, 'api-stack');
  }
}
