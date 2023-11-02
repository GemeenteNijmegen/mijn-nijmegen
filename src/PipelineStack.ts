import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Stack, StackProps, Tags, pipelines, CfnParameter, Aspects } from 'aws-cdk-lib';
import { ShellStep } from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { ApiStage } from './ApiStage';
import { Configurable } from './Configuration';
import { ParameterStage } from './ParameterStage';
import { Statics } from './statics';

export interface PipelineStackProps extends StackProps, Configurable {}

/**
 * The pipeline runs in a build environment, and is responsible for deploying
 * Cloudformation stacks to the workload account. The pipeline will first build
 * and synth the project, then deploy (self-mutating if necessary).
 *
 * The pipeline can optionally run a validation step, which runs playwright tests
 * against the deployed environment. This does not run in production since we do
 * not have a mechanism to do end-to-end auth tests in production.
 */
export class PipelineStack extends Stack {
  branchName: string;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);
    Aspects.of(this).add(new PermissionsBoundaryAspect());
    this.branchName = props.configuration.branch;

    /** On first deploy, providing a connectionArn param to `cdk deploy` is required, so the
     * codestarconnection can be setup. This connection is responsible for further deploys
     * triggering from a commit to the specified branch on Github.
     */
    const connectionArn = new CfnParameter(this, 'connectionArn');
    const source = this.connectionSource(connectionArn);

    const pipeline = this.pipeline(source, props);
    pipeline.addStage(new ParameterStage(this, 'mijn-nijmegen-parameters', {
      env: props.configuration.deploymentEnvironment,
      configuration: props.configuration,
    }));

    const apiStage = pipeline.addStage(new ApiStage(this, 'mijn-api', {
      env: props.configuration.deploymentEnvironment,
      configuration: props.configuration,
    }));
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
        'yarn install --frozen-lockfile', // Install dependencies
        'npx playwright install', // Install playwright TODO: Run playwright in LambdaTest instead
        'npx playwright install-deps',
        'npx playwright test', // Run tests
      ],
    }));
  }

  pipeline(source: pipelines.CodePipelineSource, props: PipelineStackProps): pipelines.CodePipeline {
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

    const pipeline = new pipelines.CodePipeline(this, props.configuration.pipelineName, {
      pipelineName: props.configuration.pipelineName,
      crossAccountKeys: true,
      synth: synthStep,
    });
    return pipeline;
  }

  /**
   * We use a codestarconnection to trigger automatic deploys from Github
   *
   * The value for this ARN can be found in the CodePipeline service under [settings->connections](https://eu-central-1.console.aws.amazon.com/codesuite/settings/connections?region=eu-central-1)
   * Usually this will be in the build-account.
   *
   * @param connectionArn the ARN for the codestarconnection.
   * @returns
   */
  private connectionSource(connectionArn: CfnParameter): pipelines.CodePipelineSource {
    return pipelines.CodePipelineSource.connection('GemeenteNijmegen/mijn-nijmegen', this.branchName, {
      connectionArn: connectionArn.valueAsString,
    });
  }
}
