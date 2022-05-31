import { Stack, StackProps, Tags, pipelines, CfnParameter, Environment } from 'aws-cdk-lib';
import { ShellStep } from 'aws-cdk-lib/pipelines';
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

    const connectionArn = new CfnParameter(this, 'connectionArn');
    const source = this.connectionSource(connectionArn);

    const pipeline = this.pipeline(source);
    pipeline.addStage(new ParameterStage(this, 'mijn-nijmegen-parameters', { env: props.deployToEnvironment }));

    const apiStage = pipeline.addStage(new ApiStage(this, 'mijn-api', { env: props.deployToEnvironment, branch: this.branchName }));
    this.runValidationChecks(apiStage, source);

  }

  /**
   * Run validation checks on the finished deployment (for now this runs playwright e2e tests)
   *
   * @param stage stage after which to run
   * @param source the source repo in which to run
   */
  private runValidationChecks(stage: pipelines.StageDeployment, source: pipelines.CodePipelineSource) {
    if (this.branchName != 'acceptance') { return; }
    stage.addPost(new ShellStep('validate', {
      input: source,
      env: {
        CI: 'true',
      },
      commands: [
        'yarn install --frozen-lockfile',
        'npx playwright install',
        'npx playwright install-deps',
        'npx playwright test',
      ],
    }));
  }

  pipeline(source: pipelines.CodePipelineSource): pipelines.CodePipeline {
    const synthStep = new pipelines.ShellStep('Synth', {
      input: source,
      env: {
        BRANCH_NAME: this.branchName,
      },
      commands: [
        'yarn install --frozen-lockfile',
        'npx projen build',
        'npx projen synth',
      ],
    });

    const pipeline = new pipelines.CodePipeline(this, `mijnnijmegen-${this.branchName}`, {
      pipelineName: `mijnnijmegen-${this.branchName}`,
      dockerEnabledForSelfMutation: true,
      dockerEnabledForSynth: true,
      crossAccountKeys: true,
      synth: synthStep,
    });
    return pipeline;
  }

  private connectionSource(connectionArn: CfnParameter): pipelines.CodePipelineSource {
    return pipelines.CodePipelineSource.connection('GemeenteNijmegen/mijn-nijmegen', this.branchName, {
      connectionArn: connectionArn.valueAsString,
    });
  }
}