import { Stack, StackProps, Tags, pipelines, CfnParameter, Environment } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStage } from './ApiStage';
import { ParameterStage } from './ParameterStage';
import { Statics } from './statics';

export interface PipelineStackProps extends StackProps{
  branchName: string;
  deployToEnvironment: Environment;
}

export class PipelineStack extends Stack {
  branchName: string;
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);
    this.branchName = props.branchName;
    const pipeline = this.pipeline();
    pipeline.addStage(new ParameterStage(this, 'mijn-nijmegen-parameters', { env: props.deployToEnvironment }));
    pipeline.addStage(new ApiStage(this, 'mijn-api', { env: props.deployToEnvironment, branch: this.branchName }));
  }

  pipeline(): pipelines.CodePipeline {
    const connectionArn = new CfnParameter(this, 'connectionArn');
    const source = pipelines.CodePipelineSource.connection('GemeenteNijmegen/mijn-nijmegen', this.branchName, {
      connectionArn: connectionArn.valueAsString,
    });
    const pipeline = new pipelines.CodePipeline(this, `mijnnijmegen-${this.branchName}`, {
      pipelineName: `mijnnijmegen-${this.branchName}`,
      dockerEnabledForSelfMutation: true,
      dockerEnabledForSynth: true,
      crossAccountKeys: true,
      synth: new pipelines.ShellStep('Synth', {
        input: source,
        env: {
          BRANCH_NAME: this.branchName,
        },
        commands: [
          'yarn install --frozen-lockfile',
          'npx projen build',
          'npx projen synth',
        ],
      }),
    });
    return pipeline;
  }
}