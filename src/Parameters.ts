import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, Stack, Stage, StageProps, Tags } from 'aws-cdk-lib';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './Statics';

export interface ParameterStageProps extends StageProps, Configurable { }

/**
 * Stage for creating SSM parameters. This needs to run
 * before stages that use them.
 */
export class ParameterStage extends Stage {
  constructor(scope: Construct, id: string, props: ParameterStageProps) {
    super(scope, id, props);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);
    Aspects.of(this).add(new PermissionsBoundaryAspect());
    new ParameterStack(this, 'stack');
  }
}

/**
 * Stack that creates ssm parameters for the application.
 * These need to be present before stacks that use them.
 */
export class ParameterStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);

    new StringParameter(this, 'ssm-dummy', {
      stringValue: '-',
      parameterName: Statics.ssmDummyParameter,
    });

  }
}