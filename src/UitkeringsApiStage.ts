import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { UitkeringsApiStack } from './UitkeringsApiStack';

export interface UitkeringsApiStageProps extends StageProps {
  branch: string;
}

/**
 * Stage responsible for the API Gateway and lambdas
 */
export class UitkeringsApiStage extends Stage {
  constructor(scope: Construct, id: string, props: UitkeringsApiStageProps) {
    super(scope, id, props);

    new UitkeringsApiStack(this, 'uitkerings-api', {
      branch: props.branch,
    });
  }
}