import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { MainStack } from './MainStack';

interface MainStageProps extends StageProps, Configurable { }

/**
 * Main cdk app stage
 * TODO you probably want to rename this stage
 */
export class MainStage extends Stage {

  constructor(scope: Construct, id: string, props: MainStageProps) {
    super(scope, id, props);
    Aspects.of(this).add(new PermissionsBoundaryAspect());

    /**
     * Main stack of this project
     * TODO you probably want to rename this stack
     */
    new MainStack(this, 'stack', { // Translates to mijn-services-stack
      env: props.configuration.deploymentEnvironment,
      configuration: props.configuration,
    });

  }

}