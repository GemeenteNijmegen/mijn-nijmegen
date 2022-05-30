import { aws_codebuild, Stack, StackProps, Stage, StageProps } from 'aws-cdk-lib';
import { Artifact } from 'aws-cdk-lib/aws-codepipeline';
import { CodeBuildAction, CodeStarConnectionsSourceAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Construct } from 'constructs';
import { Statics } from './statics';

export interface TestStageProps extends StageProps {
  branch: string;
  sourceArn: string;
}

/**
 * Stage responsible for the API Gateway and lambdas
 */
export class TestStage extends Stage {
  constructor(scope: Construct, id: string, props: TestStageProps) {
    super(scope, id, props);
    new TestStack(this, 'key-stack', {
      branch: props.branch,
      sourceArn: props.sourceArn,
    });

  }
}

export interface TestStackProps extends StackProps {
  branch: string;
  sourceArn: string;
}

export class TestStack extends Stack {
  constructor(scope: Construct, id: string, props: TestStackProps) {
    super(scope, id);
    const sourceOutput = new Artifact();

    new CodeStarConnectionsSourceAction({
      codeBuildCloneOutput: true,
      actionName: 'clone-from-github',
      connectionArn: props.sourceArn,
      owner: Statics.repositoryOwner,
      repo: Statics.repository,
      branch: props.branch,
      output: sourceOutput,
      triggerOnPush: false,
    });

    const project = new aws_codebuild.Project(this, 'integration-tests', {
      buildSpec: aws_codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              'yarn install --frozen-lockfile',
              'npx projen build',
              'npx projen playwright',
            ],
          },
        },
      }),
    });

    new CodeBuildAction({
      actionName: 'run-integration-tests',
      input: sourceOutput,
      project: project,
    });


  }
}