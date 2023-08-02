import { App } from 'aws-cdk-lib';
import * as Dotenv from 'dotenv';
import { getEnvironmentConfiguration } from './Configuration';
import { PipelineStack } from './PipelineStack';

Dotenv.config();
const app = new App();

const branchToBuild = process.env.BRANCH_NAME ?? 'acceptance';
const configuration = getEnvironmentConfiguration(branchToBuild);

new PipelineStack(app, configuration.pipelineStackCdkName, {
  env: configuration.buildEnvironment,
  configuration: configuration,
});

app.synth();